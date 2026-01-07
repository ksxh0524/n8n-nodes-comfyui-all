import { randomUUID } from 'crypto';
import { VALIDATION, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from './constants';
import { IExecuteFunctions } from 'n8n-workflow';
import FormData from 'form-data';
import { Logger } from './logger';
import { extractFileInfo, validateMimeType } from './utils';

export interface ComfyUIClientConfig {
  baseUrl: string;
  clientId?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  helpers: IExecuteFunctions['helpers'];
  logger?: Logger;
}

export interface WorkflowNode {
  inputs?: Record<string, unknown>;
  class_type: string;
}

export interface WorkflowExecution {
  prompt: Record<string, WorkflowNode>;
  client_id?: string;
}

export interface WorkflowResult {
  success: boolean;
  images?: string[];
  videos?: string[];
  output?: Record<string, unknown>;
  error?: string;
}

export class ComfyUIClient {
  private helpers: IExecuteFunctions['helpers'];
  private logger: Logger;
  private baseUrl: string;
  private timeout: number;
  private clientId: string;
  private maxRetries: number;
  private isDestroyed: boolean = false;
  private abortController: AbortController | null = null;

  constructor(config: ComfyUIClientConfig) {
    this.helpers = config.helpers;
    this.logger = config.logger || new Logger();
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || VALIDATION.REQUEST_TIMEOUT_MS;
    this.clientId = config.clientId || this.generateClientId();
    this.maxRetries = config.maxRetries ?? VALIDATION.MAX_RETRIES;
  }

  /**
   * Cancel any ongoing request and clean up resources
   */
  cancelRequest(): void {
    this.isDestroyed = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Clean up resources when the client is no longer needed
   */
  destroy(): void {
    this.cancelRequest();
  }

  /**
   * Check if the client has been destroyed
   */
  isClientDestroyed(): boolean {
    return this.isDestroyed;
  }

  /**
   * Generate a unique client ID
   * @returns Unique client ID string
   */
  private generateClientId(): string {
    return `client_${randomUUID()}`;
  }

  /**
   * Delay execution for a specified time
   * @param ms - Delay time in milliseconds
   * @returns Promise that resolves after the delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry a request with exponential backoff
   * @param requestFn - Function that returns a Promise to retry
   * @param retries - Maximum number of retry attempts
   * @returns Promise that resolves when the request succeeds
   * @throws Error if all retry attempts fail
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries: number = this.maxRetries,
  ): Promise<T> {
    let lastError: any;
    const baseDelay = VALIDATION.RETRY_DELAY_MS as number;
    const maxBackoffDelay = VALIDATION.MAX_BACKOFF_DELAY_RETRY as number;
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
      } catch (error: any) {
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
  async executeWorkflow(workflow: Record<string, WorkflowNode>): Promise<WorkflowResult> {
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

      const response = await this.retryRequest(() =>
        this.helpers.httpRequest({
          method: 'POST',
          url: `${this.baseUrl}/prompt`,
          json: true,
          body: requestBody,
          timeout: this.timeout,
        }),
      );

      this.logger.debug('Response from ComfyUI:', JSON.stringify(response, null, 2));

      if (response.prompt_id) {
        return await this.waitForExecution(response.prompt_id);
      }

      return {
        success: false,
        error: 'Failed to execute workflow: No prompt_id returned',
      };
    } catch (error: any) {
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
  private preparePrompt(workflow: Record<string, WorkflowNode>): Record<string, WorkflowNode> {
    const prompt: Record<string, WorkflowNode> = {};

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
  private async waitForExecution(promptId: string, maxWaitTime: number = VALIDATION.MAX_WAIT_TIME_MS): Promise<WorkflowResult> {
    const startTime = Date.now();
    let lastStatus = 'pending';
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = VALIDATION.MAX_CONSECUTIVE_ERRORS as number;
    let totalErrors = 0;
    const maxTotalErrors = VALIDATION.MAX_TOTAL_ERRORS as number;
    let backoffDelay = VALIDATION.POLL_INTERVAL_MS as number;
    const maxBackoffDelay = VALIDATION.MAX_BACKOFF_DELAY_POLLING as number;
    const baseDelay = VALIDATION.POLL_INTERVAL_MS as number;

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
      } catch (error: any) {
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
  private extractResults(outputs: any): WorkflowResult {
    const result: WorkflowResult = {
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
          result.images!.push(imageUrl);
        }
      }

      // Process videos (videos array)
      if (nodeOutput.videos && Array.isArray(nodeOutput.videos)) {
        for (const video of nodeOutput.videos) {
          const videoUrl = `/view?filename=${video.filename}&subfolder=${video.subfolder || ''}&type=${video.type}`;
          result.videos!.push(videoUrl);
        }
      }

      // Process videos (gifs array) - some nodes use this name
      if (nodeOutput.gifs && Array.isArray(nodeOutput.gifs)) {
        for (const video of nodeOutput.gifs) {
          const videoUrl = `/view?filename=${video.filename}&subfolder=${video.subfolder || ''}&type=${video.type}`;
          result.videos!.push(videoUrl);
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
  async getHistory(limit: number = 100): Promise<Record<string, unknown>> {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed');
    }

    const response = await this.retryRequest(() =>
      this.helpers.httpRequest({
        method: 'GET',
        url: `${this.baseUrl}/history`,
        qs: { limit },
        json: true,
        timeout: this.timeout,
      }),
    );
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
  async uploadImage(imageData: Buffer, filename: string, overwrite: boolean = false): Promise<string> {
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
    const maxSize = VALIDATION.MAX_IMAGE_SIZE_MB as number * 1024 * 1024;
    if (imageData.length > maxSize) {
      throw new Error(
        `Image size (${Math.round(imageData.length / 1024 / 1024)}MB) exceeds maximum allowed size of ${VALIDATION.MAX_IMAGE_SIZE_MB as number}MB`
      );
    }

    this.logger.debug('Uploading image:', { filename, size: imageData.length });

    const form = new FormData();
    form.append('image', imageData, { filename: filename });
    form.append('overwrite', overwrite.toString());

    const response = await this.retryRequest(() =>
      this.helpers.httpRequest({
        method: 'POST',
        url: `${this.baseUrl}/upload/image`,
        body: form,
        headers: {
          ...form.getHeaders(),
        },
        timeout: this.timeout,
      }),
    );

    this.logger.debug('Upload response:', response);

    return response.name;
  }

  /**
   * Get system information from ComfyUI server
   * @returns Promise containing system stats
   */
  async getSystemInfo(): Promise<Record<string, unknown>> {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed');
    }

    const response = await this.retryRequest(() =>
      this.helpers.httpRequest({
        method: 'GET',
        url: `${this.baseUrl}/system_stats`,
        json: true,
        timeout: this.timeout,
      }),
    );
    return response;
  }

  /**
   * Get image buffer from ComfyUI server
   * @param imagePath - Path to the image on ComfyUI server
   * @returns Promise containing image data as Buffer
   * @throws Error if image retrieval fails
   */
  async getImageBuffer(imagePath: string): Promise<Buffer> {
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
    } catch (error: any) {
      throw new Error(`Failed to get image buffer: ${this.formatErrorMessage(error)}`);
    }
  }

  /**
   * Get video buffer from ComfyUI server
   * @param videoPath - Path to the video on ComfyUI server
   * @returns Promise containing video data as Buffer
   * @throws Error if video retrieval fails
   */
  async getVideoBuffer(videoPath: string): Promise<Buffer> {
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
    } catch (error: any) {
      throw new Error(`Failed to get video buffer: ${this.formatErrorMessage(error)}`);
    }
  }

  /**
   * Format error message with additional context
   */
  private formatErrorMessage(error: any, context: string = ''): string {
    if (error.response) {
      return `${context}: ${error.response.statusCode} ${error.response.statusMessage}`;
    } else if (error.request) {
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
  async processResults(result: WorkflowResult, outputBinaryKey: string = 'data'): Promise<{
    json: Record<string, any>;
    binary: Record<string, any>;
  }> {
    const jsonData: Record<string, any> = {
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

    const binaryData: Record<string, any> = {};

    if (result.images && result.images.length > 0) {
      for (let i = 0; i < result.images.length; i++) {
        const imagePath = result.images[i];
        const imageBuffer = await this.getImageBuffer(imagePath);

        const fileInfo = extractFileInfo(imagePath, 'png');
        const mimeType = validateMimeType(fileInfo.mimeType, IMAGE_MIME_TYPES);

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
        const fileInfo = extractFileInfo(videoPath, 'mp4');
        const mimeType = validateMimeType(fileInfo.mimeType, VIDEO_MIME_TYPES);

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
