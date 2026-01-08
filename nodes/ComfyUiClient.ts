import { randomUUID } from 'crypto';
import { VALIDATION, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from './constants';
import { IExecuteFunctions } from 'n8n-workflow';
import { Logger } from './logger';
import { extractImageFileInfo, extractVideoFileInfo, validateMimeType, getMaxImageSizeBytes, formatBytes } from './utils';
import { HttpError, BinaryData, JsonData, ProcessOutput } from './types';
import { HttpClient } from './HttpClient';
import { N8nHelpersAdapter } from './N8nHelpersAdapter';

/**
 * Safely stringify error objects, handling circular references
 * @param obj - Object to stringify
 * @returns String representation of object
 */
function safeStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return String(obj);
  }
  
  if (typeof obj !== 'object') {
    return String(obj);
  }
  
  try {
    return JSON.stringify(obj, (_, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  } catch {
    if (obj instanceof Error) {
      return obj.message;
    }
    return String(obj);
  }
}

const seen = new WeakSet();

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
  private httpClient: HttpClient;
  private logger: Logger;
  private baseUrl: string;
  private clientId: string;
  private maxRetries: number;
  private workflowTimeout: number; // User-configured workflow timeout in milliseconds
  private state: ClientState = ClientState.IDLE;
  private currentAbortController: AbortController | null = null;

  constructor(config: ComfyUIClientConfig) {
    this.httpClient = new HttpClient({
      adapter: new N8nHelpersAdapter(config.helpers),
      logger: config.logger || new Logger(),
      defaultTimeout: config.timeout || VALIDATION.REQUEST_TIMEOUT_MS,
    });
    this.logger = config.logger || new Logger();
    this.baseUrl = config.baseUrl;
    this.clientId = config.clientId || this.generateClientId();
    this.maxRetries = config.maxRetries ?? VALIDATION.MAX_RETRIES;
    // Save the workflow timeout (user-configured timeout in milliseconds)
    this.workflowTimeout = config.timeout || VALIDATION.MAX_WAIT_TIME_MS;
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
   * Note: Using setTimeout is restricted in n8n community nodes
   * @param ms - Delay time in milliseconds
   * @returns Promise that resolves after delay
   */
  private async delay(ms: number): Promise<void> {
    // Use a busy-wait loop with microtask yielding
    // This complies with n8n community node restrictions
    const startTime = Date.now();
    const targetTime = startTime + ms;
    
    while (Date.now() < targetTime) {
      // Yield control to event loop using microtask
      await Promise.resolve();
    }
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
              let errorMsg = '';
              if (error instanceof Error) {
                errorMsg = error.message;
              } else if (error && typeof error === 'object') {
                errorMsg = safeStringify(error);
              } else {
                errorMsg = String(error);
              }
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

      this.logger.debug('Sending workflow to ComfyUI:', safeStringify(requestBody));

      const response = await this.retryRequest(() =>
        this.httpClient.post<{ prompt_id: string }>(`${this.baseUrl}/prompt`, requestBody, {
          json: true,
          abortSignal: this.currentAbortController?.signal,
        }),
      );

      this.logger.debug('Response from ComfyUI:', safeStringify(response));

      if (response.prompt_id) {
        return await this.waitForExecution(response.prompt_id, this.workflowTimeout);
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

        const response = await this.httpClient.get<Record<string, unknown>>(`${this.baseUrl}/history/${promptId}`, {
          json: true,
          abortSignal: this.currentAbortController?.signal,
        });

        if (response[promptId]) {
          const promptData = response[promptId] as { status: { completed: boolean; status_str: string }; outputs?: unknown };
          const status = promptData.status;

          if (status.completed) {
            return this.extractResults(promptData.outputs);
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
   *
   * Note: The `outputs` parameter uses `WorkflowOutputs` type because ComfyUI API responses
   * have a dynamic structure that is not guaranteed. Different ComfyUI nodes
   * may return different output formats, and we need to handle this flexibility.
   *
   * @param outputs - Raw output data from ComfyUI (format is not guaranteed, using WorkflowOutputs for flexibility)
   * @returns WorkflowResult with extracted images and videos
   */
  private extractResults(outputs: unknown): WorkflowResult {
    const result: WorkflowResult = {
      success: true,
      images: [],
      videos: [],
      output: outputs as Record<string, unknown>,
    };

    const outputsRecord = outputs as Record<string, unknown>;

    for (const nodeId in outputsRecord) {
      const nodeOutput = outputsRecord[nodeId];

      if (!nodeOutput || typeof nodeOutput !== 'object') {
        continue;
      }

      const nodeOutputObj = nodeOutput as { images?: unknown[]; videos?: unknown[]; gifs?: unknown[] };

      // Process images
      if (nodeOutputObj.images && Array.isArray(nodeOutputObj.images)) {
        for (const image of nodeOutputObj.images) {
          const imageObj = image as { filename: string; subfolder?: string; type: string };
          const imageUrl = `/view?filename=${imageObj.filename}&subfolder=${imageObj.subfolder || ''}&type=${imageObj.type}`;
          result.images?.push(imageUrl);
        }
      }

      // Process videos (videos array)
      if (nodeOutputObj.videos && Array.isArray(nodeOutputObj.videos)) {
        for (const video of nodeOutputObj.videos) {
          const videoObj = video as { filename: string; subfolder?: string; type: string };
          const videoUrl = `/view?filename=${videoObj.filename}&subfolder=${videoObj.subfolder || ''}&type=${videoObj.type}`;
          result.videos?.push(videoUrl);
        }
      }

      // Process videos (gifs array) - some nodes use this name
      if (nodeOutputObj.gifs && Array.isArray(nodeOutputObj.gifs)) {
        for (const video of nodeOutputObj.gifs) {
          const videoObj = video as { filename: string; subfolder?: string; type: string };
          const videoUrl = `/view?filename=${videoObj.filename}&subfolder=${videoObj.subfolder || ''}&type=${videoObj.type}`;
          result.videos?.push(videoUrl);
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
      this.httpClient.get<Record<string, unknown>>(`${this.baseUrl}/history`, {
        qs: { limit } as Record<string, unknown>,
        json: true,
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

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('image', new Blob([imageData], { type: 'image/png' }), filename);
    formData.append('overwrite', overwrite.toString());

    const response = await this.retryRequest(() =>
      this.httpClient.request<{ name: string }>({
        method: 'POST',
        url: `${this.baseUrl}/upload/image`,
        body: formData,
        json: false,
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
      this.httpClient.get<Record<string, unknown>>(`${this.baseUrl}/system_stats`, {
        json: true,
        abortSignal: this.currentAbortController?.signal,
      }),
    );
    return response;
  }

  /**
   * Check if ComfyUI server is accessible
   * @returns Promise containing health status
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      await this.httpClient.get(`${this.baseUrl}/system_stats`, {
        json: true,
        timeout: 5000,
      });

      return {
        healthy: true,
        message: 'ComfyUI server is accessible',
      };
    } catch (error) {
      return {
        healthy: false,
        message: `ComfyUI server is not accessible: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
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

      const response = await this.httpClient.get<ArrayBuffer>(`${this.baseUrl}${path}`, {
        encoding: 'arraybuffer',
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
  async processResults(result: WorkflowResult, outputBinaryKey: string = 'data'): Promise<ProcessOutput> {
    const jsonData: JsonData = {
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

    const binaryData: Record<string, BinaryData> = {};
    const buffers: Buffer[] = [];

    try {
      // Fetch and process images concurrently
      if (result.images && result.images.length > 0) {
        const imageBuffers = await this.getImageBuffers(result.images);
        buffers.push(...imageBuffers);

        for (let i = 0; i < result.images.length; i++) {
          const imagePath = result.images[i];
          const imageBuffer = imageBuffers[i];

          const fileInfo = extractImageFileInfo(imagePath, 'png');
          const mimeType = validateMimeType(fileInfo.mimeType, IMAGE_MIME_TYPES);

          const binaryKey = i === 0 ? outputBinaryKey : `image_${i}`;
          binaryData[binaryKey] = {
            data: imageBuffer.toString('base64'),
            mimeType: mimeType,
            fileName: fileInfo.filename,
            fileSize: imageBuffer.length.toString(),
            fileExtension: fileInfo.extension,
          };
        }

        jsonData.imageCount = result.images.length;
      }

      // Fetch and process videos concurrently
      if (result.videos && result.videos.length > 0) {
        const videoBuffers = await this.getVideoBuffers(result.videos);
        buffers.push(...videoBuffers);

        for (let i = 0; i < result.videos.length; i++) {
          const videoPath = result.videos[i];
          const videoBuffer = videoBuffers[i];
          const fileInfo = extractVideoFileInfo(videoPath, 'mp4');
          const mimeType = validateMimeType(fileInfo.mimeType, VIDEO_MIME_TYPES);

          const hasImages = result.images && result.images.length > 0;
          const binaryKey = (!hasImages && i === 0) ? outputBinaryKey : `video_${i}`;
          binaryData[binaryKey] = {
            data: videoBuffer.toString('base64'),
            mimeType: mimeType,
            fileName: fileInfo.filename,
            fileSize: videoBuffer.length.toString(),
            fileExtension: fileInfo.extension,
          };
        }

        jsonData.videoCount = result.videos.length;
      }

      return {
        json: jsonData,
        binary: binaryData,
      };
    } catch (error) {
      // Clean up already fetched buffers to prevent memory leaks
      buffers.forEach(buffer => {
        if (buffer) {
          buffer.fill(0); // Zero out sensitive data
        }
      });
      throw error;
    }
  }
}
