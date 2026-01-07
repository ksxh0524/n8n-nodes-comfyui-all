import { randomUUID } from 'crypto';
import { VALIDATION, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from './constants';
import { IExecuteFunctions } from 'n8n-workflow';
import FormData from 'form-data';
import { Logger } from './logger';
import { extractFileInfo, validateMimeType, getMaxImageSizeBytes, formatBytes } from './utils';
import { HttpError } from './types';

/**
 * Client state enumeration for state machine pattern
 */
enum ClientState {
  IDLE = 'idle',
  REQUESTING = 'requesting',
  DESTROYED = 'destroyed',
}

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
  private state: ClientState = ClientState.IDLE;
  private currentAbortController: AbortController | null = null;

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
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Clean up resources when the client is no longer needed
   */
  destroy(): void {
    this.state = ClientState.DESTROYED;
    this.cancelRequest();
  }

  /**
   * Check if the client has been destroyed
   */
  isClientDestroyed(): boolean {
    return this.state === ClientState.DESTROYED;
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
    // Check if client is destroyed before starting
    if (this.state === ClientState.DESTROYED) {
      throw new Error('Client has been destroyed');
    }

    let lastError: unknown;
    const baseDelay = VALIDATION.RETRY_DELAY_MS as number;
    const maxBackoffDelay = VALIDATION.MAX_BACKOFF_DELAY_RETRY as number;
    let backoffDelay = baseDelay;

    // Set state to REQUESTING and create AbortController
    this.state = ClientState.REQUESTING;
    this.currentAbortController = new AbortController();

    try {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // Check if request was aborted
          if (this.currentAbortController.signal.aborted) {
            throw new Error('Request aborted');
          }

          return await requestFn();
        } catch (error: unknown) {
          lastError = error;

          // If aborted, don't retry
          if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Request aborted')) {
            throw new Error('Request was cancelled');
          }

          if (attempt < retries) {
            // Exponential backoff: double the delay with each error, capped at maxBackoffDelay
            backoffDelay = Math.min(backoffDelay * 2, maxBackoffDelay);

            if (attempt > 0) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              this.logger.warn(`Request attempt ${attempt + 1}/${retries + 1} failed, retrying in ${backoffDelay}ms: ${errorMsg}`);
            }

            // Wait before retrying with exponential backoff
            await this.delay(backoffDelay);
          }
        }
      }

      throw lastError;
    } finally {
      // Reset state to IDLE after request completes
      this.state = ClientState.IDLE;
    }
  }

  /**
   * Execute a ComfyUI workflow
   * @param workflow - Workflow object containing nodes and their configurations
   * @returns Promise containing workflow execution result
   */
  async executeWorkflow(workflow: Record<string, WorkflowNode>): Promise<WorkflowResult> {
    try {
      if (this.isClientDestroyed()) {
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
          abortSignal: this.currentAbortController?.signal,
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
    } catch (error: unknown) {
      this.logger.error('Workflow execution error:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      const httpError = err as HttpError;
      this.logger.error('Error details:', {
        message: err.message,
        statusCode: httpError.response?.statusCode || httpError.statusCode,
        statusMessage: httpError.response?.statusMessage || httpError.statusMessage,
        responseBody: httpError.response?.body || httpError.response?.data,
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
        if (this.isClientDestroyed()) {
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
          abortSignal: this.currentAbortController?.signal,
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
      } catch (error: unknown) {
        consecutiveErrors++;
        totalErrors++;

        const errorMsg = error instanceof Error ? error.message : String(error);

        // Check consecutive errors limit
        if (consecutiveErrors >= maxConsecutiveErrors) {
          return {
            success: false,
            error: `Workflow execution failed after ${maxConsecutiveErrors} consecutive errors: ${errorMsg}`,
          };
        }

        // Check total errors limit to prevent resource exhaustion
        if (totalErrors >= maxTotalErrors) {
          return {
            success: false,
            error: `Workflow execution failed after ${maxTotalErrors} total errors (last: ${errorMsg})`,
          };
        }

        // Exponential backoff: double the delay with each error, capped at maxBackoffDelay
        backoffDelay = Math.min(backoffDelay * 2, maxBackoffDelay);

        this.logger.warn(`Polling error ${consecutiveErrors}/${maxConsecutiveErrors} (total: ${totalErrors}/${maxTotalErrors}), retrying in ${backoffDelay}ms: ${errorMsg}`);

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
    if (this.isClientDestroyed()) {
      throw new Error('Client has been destroyed');
    }

    const response = await this.retryRequest(() =>
      this.helpers.httpRequest({
        method: 'GET',
        url: `${this.baseUrl}/history`,
        qs: { limit },
        json: true,
        timeout: this.timeout,
        abortSignal: this.currentAbortController?.signal,
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
    if (this.isClientDestroyed()) {
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
    const maxSize = getMaxImageSizeBytes();
    if (imageData.length > maxSize) {
      throw new Error(
        `Image size (${formatBytes(imageData.length)}) exceeds maximum allowed size of ${formatBytes(maxSize)}`
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
        abortSignal: this.currentAbortController?.signal,
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
    if (this.isClientDestroyed()) {
      throw new Error('Client has been destroyed');
    }

    const response = await this.retryRequest(() =>
      this.helpers.httpRequest({
        method: 'GET',
        url: `${this.baseUrl}/system_stats`,
        json: true,
        timeout: this.timeout,
        abortSignal: this.currentAbortController?.signal,
      }),
    );
    return response;
  }

  /**
   * Get buffer from ComfyUI server (internal method)
   * @param path - Path to the resource on ComfyUI server
   * @param resourceType - Type of resource ('image' or 'video')
   * @returns Promise containing resource data as Buffer
   * @throws Error if resource retrieval fails
   */
  private async getBuffer(path: string, resourceType: 'image' | 'video'): Promise<Buffer> {
    try {
      if (this.isClientDestroyed()) {
        throw new Error('Client has been destroyed');
      }

      const response = await this.helpers.httpRequest({
        method: 'GET',
        url: `${this.baseUrl}${path}`,
        encoding: 'arraybuffer',
        timeout: this.timeout,
        abortSignal: this.currentAbortController?.signal,
      });
      const buffer = Buffer.from(response);

      // Validate buffer size (maximum 50MB as defined in VALIDATION.MAX_IMAGE_SIZE_MB)
      const maxSize = getMaxImageSizeBytes();
      if (buffer.length > maxSize) {
        const resourceTypeLabel = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
        throw new Error(
          `${resourceTypeLabel} size (${formatBytes(buffer.length)}) exceeds maximum allowed size of ${formatBytes(maxSize)}`
        );
      }

      return buffer;
    } catch (error: unknown) {
      throw new Error(`Failed to get ${resourceType} buffer: ${this.formatErrorMessage(error)}`);
    }
  }

  /**
   * Get image buffer from ComfyUI server
   * @param imagePath - Path to the image on ComfyUI server
   * @returns Promise containing image data as Buffer
   * @throws Error if image retrieval fails
   */
  async getImageBuffer(imagePath: string): Promise<Buffer> {
    return this.getBuffer(imagePath, 'image');
  }

  /**
   * Get video buffer from ComfyUI server
   * @param videoPath - Path to the video on ComfyUI server
   * @returns Promise containing video data as Buffer
   * @throws Error if video retrieval fails
   */
  async getVideoBuffer(videoPath: string): Promise<Buffer> {
    return this.getBuffer(videoPath, 'video');
  }

  /**
   * Get multiple image buffers concurrently from ComfyUI server
   * @param imagePaths - Array of paths to the images on ComfyUI server
   * @returns Promise containing array of image data as Buffers
   * @throws Error if any image retrieval fails
   */
  async getImageBuffers(imagePaths: string[]): Promise<Buffer[]> {
    return Promise.all(imagePaths.map(path => this.getImageBuffer(path)));
  }

  /**
   * Get multiple video buffers concurrently from ComfyUI server
   * @param videoPaths - Array of paths to the videos on ComfyUI server
   * @returns Promise containing array of video data as Buffers
   * @throws Error if any video retrieval fails
   */
  async getVideoBuffers(videoPaths: string[]): Promise<Buffer[]> {
    return Promise.all(videoPaths.map(path => this.getVideoBuffer(path)));
  }

  /**
   * Format error message with additional context
   */
  private formatErrorMessage(error: unknown, context: string = ''): string {
    if (error instanceof Error) {
      const httpError = error as HttpError;
      if (httpError.response) {
        return `${context}: ${httpError.response.statusCode} ${httpError.response.statusMessage}`;
      } else if (httpError.statusCode) {
        return `${context}: ${httpError.statusCode} ${httpError.statusMessage || ''}`;
      }
      return context ? `${context}: ${error.message}` : error.message;
    }
    return context ? `${context}: ${String(error)}` : String(error);
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
