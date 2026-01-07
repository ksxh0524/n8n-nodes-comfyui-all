"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComfyUIClient = void 0;
const crypto_1 = require("crypto");
const constants_1 = require("./constants");
const form_data_1 = __importDefault(require("form-data"));
const logger_1 = require("./logger");
const utils_1 = require("./utils");
class ComfyUIClient {
    constructor(config) {
        this.isDestroyed = false;
        this.abortController = null;
        this.helpers = config.helpers;
        this.logger = config.logger || new logger_1.Logger();
        this.baseUrl = config.baseUrl;
        this.timeout = config.timeout || constants_1.VALIDATION.REQUEST_TIMEOUT_MS;
        this.clientId = config.clientId || this.generateClientId();
        this.maxRetries = config.maxRetries ?? constants_1.VALIDATION.MAX_RETRIES;
    }
    /**
     * Cancel any ongoing request and clean up resources
     */
    cancelRequest() {
        this.isDestroyed = true;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
    /**
     * Clean up resources when the client is no longer needed
     */
    destroy() {
        this.cancelRequest();
    }
    /**
     * Check if the client has been destroyed
     */
    isClientDestroyed() {
        return this.isDestroyed;
    }
    /**
     * Generate a unique client ID
     * @returns Unique client ID string
     */
    generateClientId() {
        return `client_${(0, crypto_1.randomUUID)()}`;
    }
    /**
     * Delay execution for a specified time
     * @param ms - Delay time in milliseconds
     * @returns Promise that resolves after the delay
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Retry a request with exponential backoff
     * @param requestFn - Function that returns a Promise to retry
     * @param retries - Maximum number of retry attempts
     * @returns Promise that resolves when the request succeeds
     * @throws Error if all retry attempts fail
     */
    async retryRequest(requestFn, retries = this.maxRetries) {
        let lastError;
        const baseDelay = constants_1.VALIDATION.RETRY_DELAY_MS;
        const maxBackoffDelay = constants_1.VALIDATION.MAX_BACKOFF_DELAY_RETRY;
        let backoffDelay = baseDelay;
        // Create new AbortController for this request
        this.abortController = new AbortController();
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (this.isDestroyed) {
                    throw new Error('Client has been destroyed');
                }
                // Check if request was aborted
                if (this.abortController.signal.aborted) {
                    throw new Error('Request aborted');
                }
                return await requestFn();
            }
            catch (error) {
                lastError = error;
                // If aborted, don't retry
                if (error.name === 'AbortError' || error.message === 'Request aborted') {
                    throw new Error('Request was cancelled');
                }
                if (attempt < retries) {
                    // Exponential backoff: double the delay with each error, capped at maxBackoffDelay
                    backoffDelay = Math.min(backoffDelay * 2, maxBackoffDelay);
                    if (attempt > 0) {
                        this.logger.warn(`Request attempt ${attempt + 1}/${retries + 1} failed, retrying in ${backoffDelay}ms: ${error.message}`);
                    }
                    // Wait before retrying with exponential backoff
                    await this.delay(backoffDelay);
                }
            }
        }
        throw lastError;
    }
    /**
     * Execute a ComfyUI workflow
     * @param workflow - Workflow object containing nodes and their configurations
     * @returns Promise containing workflow execution result
     */
    async executeWorkflow(workflow) {
        try {
            if (this.isDestroyed) {
                return {
                    success: false,
                    error: 'Client has been destroyed',
                };
            }
            const prompt = this.preparePrompt(workflow);
            const requestBody = {
                prompt,
                client_id: this.clientId,
            };
            this.logger.debug('Sending workflow to ComfyUI:', JSON.stringify(requestBody, null, 2));
            const response = await this.retryRequest(() => this.helpers.httpRequest({
                method: 'POST',
                url: `${this.baseUrl}/prompt`,
                json: true,
                body: requestBody,
                timeout: this.timeout,
            }));
            this.logger.debug('Response from ComfyUI:', JSON.stringify(response, null, 2));
            if (response.prompt_id) {
                return await this.waitForExecution(response.prompt_id);
            }
            return {
                success: false,
                error: 'Failed to execute workflow: No prompt_id returned',
            };
        }
        catch (error) {
            this.logger.error('Workflow execution error:', error);
            this.logger.error('Error details:', {
                message: error.message,
                statusCode: error.response?.statusCode || error.statusCode,
                statusMessage: error.response?.statusMessage || error.statusMessage,
                responseBody: error.response?.body || error.response?.data,
            });
            return {
                success: false,
                error: this.formatErrorMessage(error, 'Failed to execute workflow'),
            };
        }
    }
    /**
     * Prepare workflow prompt for ComfyUI API
     * @param workflow - Workflow object containing nodes
     * @returns Formatted prompt object
     */
    preparePrompt(workflow) {
        const prompt = {};
        for (const nodeId in workflow) {
            const node = workflow[nodeId];
            prompt[nodeId] = {
                inputs: node.inputs || {},
                class_type: node.class_type,
            };
        }
        return prompt;
    }
    /**
     * Wait for workflow execution to complete
     * @param promptId - Prompt ID from ComfyUI
     * @param maxWaitTime - Maximum time to wait in milliseconds
     * @returns Promise containing workflow execution result
     */
    async waitForExecution(promptId, maxWaitTime = constants_1.VALIDATION.MAX_WAIT_TIME_MS) {
        const startTime = Date.now();
        let lastStatus = 'pending';
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = constants_1.VALIDATION.MAX_CONSECUTIVE_ERRORS;
        let totalErrors = 0;
        const maxTotalErrors = constants_1.VALIDATION.MAX_TOTAL_ERRORS;
        let backoffDelay = constants_1.VALIDATION.POLL_INTERVAL_MS;
        const maxBackoffDelay = constants_1.VALIDATION.MAX_BACKOFF_DELAY_POLLING;
        const baseDelay = constants_1.VALIDATION.POLL_INTERVAL_MS;
        while (Date.now() - startTime < maxWaitTime) {
            try {
                if (this.isDestroyed) {
                    return {
                        success: false,
                        error: 'Client has been destroyed',
                    };
                }
                const response = await this.helpers.httpRequest({
                    method: 'GET',
                    url: `${this.baseUrl}/history/${promptId}`,
                    json: true,
                    timeout: this.timeout,
                });
                if (response[promptId]) {
                    const status = response[promptId].status;
                    if (status.completed) {
                        return this.extractResults(response[promptId].outputs);
                    }
                    if (lastStatus !== status.status_str) {
                        lastStatus = status.status_str;
                    }
                }
                // Reset error counter on successful request
                consecutiveErrors = 0;
                backoffDelay = baseDelay; // Reset backoff delay
                // Wait before next poll
                await this.delay(baseDelay);
            }
            catch (error) {
                consecutiveErrors++;
                totalErrors++;
                // Check consecutive errors limit
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    return {
                        success: false,
                        error: `Workflow execution failed after ${maxConsecutiveErrors} consecutive errors: ${error.message}`,
                    };
                }
                // Check total errors limit to prevent resource exhaustion
                if (totalErrors >= maxTotalErrors) {
                    return {
                        success: false,
                        error: `Workflow execution failed after ${maxTotalErrors} total errors (last: ${error.message})`,
                    };
                }
                // Exponential backoff: double the delay with each error, capped at maxBackoffDelay
                backoffDelay = Math.min(backoffDelay * 2, maxBackoffDelay);
                this.logger.warn(`Polling error ${consecutiveErrors}/${maxConsecutiveErrors} (total: ${totalErrors}/${maxTotalErrors}), retrying in ${backoffDelay}ms: ${error.message}`);
                // Wait with exponential backoff
                await this.delay(backoffDelay);
            }
        }
        return {
            success: false,
            error: 'Workflow execution timeout',
        };
    }
    /**
     * Extract image and video results from workflow outputs
     * @param outputs - Raw output data from ComfyUI
     * @returns WorkflowResult with extracted images and videos
     */
    extractResults(outputs) {
        const result = {
            success: true,
            images: [],
            videos: [],
            output: outputs,
        };
        for (const nodeId in outputs) {
            const nodeOutput = outputs[nodeId];
            // Process images
            if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
                for (const image of nodeOutput.images) {
                    const imageUrl = `/view?filename=${image.filename}&subfolder=${image.subfolder || ''}&type=${image.type}`;
                    result.images.push(imageUrl);
                }
            }
            // Process videos (videos array)
            if (nodeOutput.videos && Array.isArray(nodeOutput.videos)) {
                for (const video of nodeOutput.videos) {
                    const videoUrl = `/view?filename=${video.filename}&subfolder=${video.subfolder || ''}&type=${video.type}`;
                    result.videos.push(videoUrl);
                }
            }
            // Process videos (gifs array) - some nodes use this name
            if (nodeOutput.gifs && Array.isArray(nodeOutput.gifs)) {
                for (const video of nodeOutput.gifs) {
                    const videoUrl = `/view?filename=${video.filename}&subfolder=${video.subfolder || ''}&type=${video.type}`;
                    result.videos.push(videoUrl);
                }
            }
        }
        return result;
    }
    /**
     * Get execution history from ComfyUI
     * @param limit - Maximum number of history entries to retrieve
     * @returns Promise containing history data
     */
    async getHistory(limit = 100) {
        if (this.isDestroyed) {
            throw new Error('Client has been destroyed');
        }
        const response = await this.retryRequest(() => this.helpers.httpRequest({
            method: 'GET',
            url: `${this.baseUrl}/history`,
            qs: { limit },
            json: true,
            timeout: this.timeout,
        }));
        return response;
    }
    /**
     * Upload an image to ComfyUI server
     * @param imageData - Image data as Buffer
     * @param filename - Name of the file to upload
     * @param overwrite - Whether to overwrite existing file
     * @returns Promise containing the uploaded filename
     * @throws Error if image data is invalid or upload fails
     */
    async uploadImage(imageData, filename, overwrite = false) {
        if (this.isDestroyed) {
            throw new Error('Client has been destroyed');
        }
        // Validate image data
        if (!Buffer.isBuffer(imageData)) {
            throw new Error('Invalid image data: expected Buffer');
        }
        if (imageData.length === 0) {
            throw new Error('Invalid image data: buffer is empty');
        }
        // Validate image size (maximum 50MB as defined in VALIDATION.MAX_IMAGE_SIZE_MB)
        const maxSize = constants_1.VALIDATION.MAX_IMAGE_SIZE_MB * 1024 * 1024;
        if (imageData.length > maxSize) {
            throw new Error(`Image size (${Math.round(imageData.length / 1024 / 1024)}MB) exceeds maximum allowed size of ${constants_1.VALIDATION.MAX_IMAGE_SIZE_MB}MB`);
        }
        this.logger.debug('Uploading image:', { filename, size: imageData.length });
        const form = new form_data_1.default();
        form.append('image', imageData, { filename: filename });
        form.append('overwrite', overwrite.toString());
        const response = await this.retryRequest(() => this.helpers.httpRequest({
            method: 'POST',
            url: `${this.baseUrl}/upload/image`,
            body: form,
            headers: {
                ...form.getHeaders(),
            },
            timeout: this.timeout,
        }));
        this.logger.debug('Upload response:', response);
        return response.name;
    }
    /**
     * Get system information from ComfyUI server
     * @returns Promise containing system stats
     */
    async getSystemInfo() {
        if (this.isDestroyed) {
            throw new Error('Client has been destroyed');
        }
        const response = await this.retryRequest(() => this.helpers.httpRequest({
            method: 'GET',
            url: `${this.baseUrl}/system_stats`,
            json: true,
            timeout: this.timeout,
        }));
        return response;
    }
    /**
     * Get image buffer from ComfyUI server
     * @param imagePath - Path to the image on ComfyUI server
     * @returns Promise containing image data as Buffer
     * @throws Error if image retrieval fails
     */
    async getImageBuffer(imagePath) {
        try {
            if (this.isDestroyed) {
                throw new Error('Client has been destroyed');
            }
            const response = await this.helpers.httpRequest({
                method: 'GET',
                url: `${this.baseUrl}${imagePath}`,
                encoding: 'arraybuffer',
                timeout: this.timeout,
            });
            return Buffer.from(response);
        }
        catch (error) {
            throw new Error(`Failed to get image buffer: ${this.formatErrorMessage(error)}`);
        }
    }
    /**
     * Get video buffer from ComfyUI server
     * @param videoPath - Path to the video on ComfyUI server
     * @returns Promise containing video data as Buffer
     * @throws Error if video retrieval fails
     */
    async getVideoBuffer(videoPath) {
        try {
            if (this.isDestroyed) {
                throw new Error('Client has been destroyed');
            }
            const response = await this.helpers.httpRequest({
                method: 'GET',
                url: `${this.baseUrl}${videoPath}`,
                encoding: 'arraybuffer',
                timeout: this.timeout,
            });
            return Buffer.from(response);
        }
        catch (error) {
            throw new Error(`Failed to get video buffer: ${this.formatErrorMessage(error)}`);
        }
    }
    /**
     * Format error message with additional context
     */
    formatErrorMessage(error, context = '') {
        if (error.response) {
            return `${context}: ${error.response.statusCode} ${error.response.statusMessage}`;
        }
        else if (error.request) {
            return `${context}: No response from server`;
        }
        return context ? `${context}: ${error.message}` : error.message;
    }
    /**
     * Process workflow execution results and format them for n8n output
     * @param result - Workflow execution result
     * @param outputBinaryKey - Property name for the first output binary data
     * @returns Processed result with json and binary data
     */
    async processResults(result, outputBinaryKey = 'data') {
        const jsonData = {
            success: true,
        };
        if (result.output) {
            jsonData.data = result.output;
        }
        if (result.images && result.images.length > 0) {
            jsonData.images = result.images;
            jsonData.imageUrls = result.images.map(img => `${this.baseUrl}${img}`);
        }
        if (result.videos && result.videos.length > 0) {
            jsonData.videos = result.videos;
            jsonData.videoUrls = result.videos.map(vid => `${this.baseUrl}${vid}`);
        }
        const binaryData = {};
        if (result.images && result.images.length > 0) {
            for (let i = 0; i < result.images.length; i++) {
                const imagePath = result.images[i];
                const imageBuffer = await this.getImageBuffer(imagePath);
                const fileInfo = (0, utils_1.extractFileInfo)(imagePath, 'png');
                const mimeType = (0, utils_1.validateMimeType)(fileInfo.mimeType, constants_1.IMAGE_MIME_TYPES);
                const binaryKey = i === 0 ? outputBinaryKey : `image_${i}`;
                binaryData[binaryKey] = {
                    data: imageBuffer.toString('base64'),
                    mimeType: mimeType,
                    fileName: fileInfo.filename,
                };
            }
            jsonData.imageCount = result.images.length;
        }
        if (result.videos && result.videos.length > 0) {
            for (let i = 0; i < result.videos.length; i++) {
                const videoPath = result.videos[i];
                const fileInfo = (0, utils_1.extractFileInfo)(videoPath, 'mp4');
                const mimeType = (0, utils_1.validateMimeType)(fileInfo.mimeType, constants_1.VIDEO_MIME_TYPES);
                const videoBuffer = await this.getVideoBuffer(videoPath);
                const hasImages = result.images && result.images.length > 0;
                const binaryKey = (!hasImages && i === 0) ? outputBinaryKey : `video_${i}`;
                binaryData[binaryKey] = {
                    data: videoBuffer.toString('base64'),
                    mimeType: mimeType,
                    fileName: fileInfo.filename,
                };
            }
            jsonData.videoCount = result.videos.length;
        }
        return {
            json: jsonData,
            binary: binaryData,
        };
    }
}
exports.ComfyUIClient = ComfyUIClient;
//# sourceMappingURL=ComfyUiClient.js.map