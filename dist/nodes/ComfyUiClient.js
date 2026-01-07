"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComfyUIClient = void 0;
const crypto_1 = require("crypto");
const constants_1 = require("./constants");
class ComfyUIClient {
    constructor(config) {
        this.isDestroyed = false;
        this.helpers = config.helpers;
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
    generateClientId() {
        return `client_${(0, crypto_1.randomUUID)()}`;
    }
    async retryRequest(requestFn, retries = this.maxRetries) {
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (this.isDestroyed) {
                    throw new Error('Client has been destroyed');
                }
                return await requestFn();
            }
            catch (error) {
                lastError = error;
                if (attempt < retries) {
                    // Use a microtask to yield control between retries
                    await Promise.resolve();
                }
            }
        }
        throw lastError;
    }
    async executeWorkflow(workflow) {
        try {
            if (this.isDestroyed) {
                return {
                    success: false,
                    error: 'Client has been destroyed',
                };
            }
            const prompt = this.preparePrompt(workflow);
            const response = await this.retryRequest(() => this.helpers.httpRequest({
                method: 'POST',
                url: `${this.baseUrl}/prompt`,
                json: true,
                body: {
                    prompt,
                    client_id: this.clientId,
                },
                timeout: this.timeout,
            }));
            if (response.prompt_id) {
                return await this.waitForExecution(response.prompt_id);
            }
            return {
                success: false,
                error: 'Failed to execute workflow: No prompt_id returned',
            };
        }
        catch (error) {
            return {
                success: false,
                error: this.formatErrorMessage(error, 'Failed to execute workflow'),
            };
        }
    }
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
    async waitForExecution(promptId, maxWaitTime = constants_1.VALIDATION.MAX_WAIT_TIME_MS) {
        const startTime = Date.now();
        let lastStatus = 'pending';
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5;
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
                // Yield control between polls
                await Promise.resolve();
            }
            catch (error) {
                consecutiveErrors++;
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    return {
                        success: false,
                        error: `Workflow execution failed after ${maxConsecutiveErrors} consecutive errors: ${error.message}`,
                    };
                }
                // Yield control between retries
                await Promise.resolve();
            }
        }
        return {
            success: false,
            error: 'Workflow execution timeout',
        };
    }
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
    async uploadImage(imageData, filename, overwrite = false) {
        if (this.isDestroyed) {
            throw new Error('Client has been destroyed');
        }
        // Detect content type from filename
        const ext = filename.split('.').pop()?.toLowerCase() || 'png';
        const contentTypes = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'webp': 'image/webp',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
        };
        const contentType = contentTypes[ext] || 'image/png';
        try {
            // Method 1: Try using n8n's body with file object
            const response = await this.retryRequest(() => this.helpers.httpRequest({
                method: 'POST',
                url: `${this.baseUrl}/upload/image`,
                body: {
                    image: {
                        value: imageData,
                        options: {
                            filename: filename,
                            contentType: contentType,
                        },
                    },
                    filename: filename,
                    overwrite: overwrite,
                },
                timeout: this.timeout,
            }));
            return response.name;
        }
        catch (error) {
            const responseBody = error.response?.data || error.response?.body;
            console.error('Upload attempt 1 failed. Response:', JSON.stringify(responseBody));
            // Method 2: Try using multipart/form-data explicitly
            try {
                const response2 = await this.retryRequest(() => this.helpers.httpRequest({
                    method: 'POST',
                    url: `${this.baseUrl}/upload/image`,
                    multipart: true,
                    formData: {
                        image: {
                            value: imageData,
                            options: {
                                filename: filename,
                                contentType: contentType,
                            },
                        },
                        filename: filename,
                        overwrite: String(overwrite),
                    },
                    timeout: this.timeout,
                }));
                return response2.name;
            }
            catch (error2) {
                const responseBody2 = error2.response?.data || error2.response?.body;
                console.error('Upload attempt 2 failed. Response:', JSON.stringify(responseBody2));
                // Method 3: Try base64 encoded JSON
                try {
                    const base64Image = imageData.toString('base64');
                    const response3 = await this.retryRequest(() => this.helpers.httpRequest({
                        method: 'POST',
                        url: `${this.baseUrl}/upload/image`,
                        body: {
                            image: base64Image,
                            filename: filename,
                            overwrite: overwrite,
                        },
                        json: true,
                        timeout: this.timeout,
                    }));
                    return response3.name;
                }
                catch (error3) {
                    const responseBody3 = error3.response?.data || error3.response?.body;
                    console.error('Upload attempt 3 failed. Response:', JSON.stringify(responseBody3));
                    // All methods failed, throw detailed error
                    throw new Error(`Failed to upload image "${filename}" to ComfyUI after 3 attempts.

Attempt 1 (body with file object): HTTP ${error.response?.statusCode || error.statusCode} - ${JSON.stringify(responseBody)}
Attempt 2 (multipart/form-data): HTTP ${error2.response?.statusCode || error2.statusCode} - ${JSON.stringify(responseBody2)}
Attempt 3 (base64 JSON): HTTP ${error3.response?.statusCode || error3.statusCode} - ${JSON.stringify(responseBody3)}

Image info: Size=${imageData.length} bytes, ContentType=${contentType}, Filename=${filename}`);
                }
            }
        }
    }
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
}
exports.ComfyUIClient = ComfyUIClient;
//# sourceMappingURL=ComfyUiClient.js.map