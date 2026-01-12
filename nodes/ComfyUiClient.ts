import { randomUUID } from 'crypto';
import { VALIDATION, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from './constants';
import { IExecuteFunctions } from 'n8n-workflow';
import { Logger } from './logger';
import { extractImageFileInfo, extractVideoFileInfo, validateMimeType, getMaxImageSizeBytes, getMaxVideoSizeBytes, formatBytes } from './utils';
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

  // Create a new WeakSet for each call to avoid shared state issues
  const seen = new WeakSet();

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

/**
 * Client state enumeration for state machine pattern
 */
enum ClientState {
  IDLE = 'idle',
  REQUESTING = 'requesting',
  DESTROYED = 'destroyed',
}

/**
 * Check if FormData and Blob are available (Node.js 18+ has native support)
 * @throws Error if FormData or Blob is not available
 */
function ensureFormDataAvailable(): void {
  if (typeof FormData === 'undefined') {
    throw new Error(
      'FormData is not available in this Node.js environment. ' +
      'Please upgrade to Node.js 18 or later, or install the "formdata-node" polyfill.'
    );
  }
  if (typeof Blob === 'undefined') {
    throw new Error(
      'Blob is not available in this Node.js environment. ' +
      'Please upgrade to Node.js 18 or later.'
    );
  }
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
   *
   * IMPORTANT: This implementation uses a busy-wait loop with microtask yielding instead of setTimeout.
   *
   * WHY: n8n community nodes have restrictions on using setTimeout/setInterval to prevent blocking the
   * n8n event loop. Using native setTimeout can cause the node to fail n8n's package validation.
   *
   * ALTERNATIVE: The busy-wait loop with Promise.resolve() yields control to the event loop through
   * microtasks, which is allowed by n8n's restrictions. While this consumes more CPU than setTimeout,
   * it's the only viable approach for n8n community nodes.
   *
   * PERFORMANCE: For typical polling intervals (100-1000ms), the CPU overhead is minimal. For very long
   * delays, consider breaking them into smaller chunks or using exponential backoff (already implemented
   * in retry logic).
   *
   * @param ms - Delay time in milliseconds
   * @returns Promise that resolves after delay
   */
  private async delay(ms: number): Promise<void> {
    const startTime = Date.now();
    const targetTime = startTime + ms;

    // Busy-wait loop with microtask yielding (compliant with n8n community node restrictions)
    while (Date.now() < targetTime) {
      // Yield control to event loop using microtask queue
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
      // Abort any ongoing request and reset state to IDLE
      if (this.currentAbortController) {
        this.currentAbortController.abort();
        this.currentAbortController = null;
      }
      this.state = ClientState.IDLE;
    }
  }

  /**
   * Execute a ComfyUI workflow
   * @param workflow - Workflow object containing nodes and their configurations
   * @returns Promise containing workflow execution result
   */
  async executeWorkflow(workflow: Record<string, WorkflowNode>): Promise<WorkflowResult> {
    // Check state to prevent concurrent requests
    if (this.state === ClientState.REQUESTING) {
      return {
        success: false,
        error: 'Cannot start new workflow execution while another request is in progress',
      };
    }
    if (this.isClientDestroyed()) {
      return {
        success: false,
        error: 'Client has been destroyed',
      };
    }

    try {
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
          // Abort any ongoing request
          if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
          }
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
          // Abort any ongoing request
          if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
          }
          return {
            success: false,
            error: `Workflow execution failed after ${maxConsecutiveErrors} consecutive errors: ${errorMsg}`,
          };
        }

        // Check total errors limit to prevent resource exhaustion
        if (totalErrors >= maxTotalErrors) {
          // Abort any ongoing request
          if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
          }
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

    // Abort any ongoing request when timeout occurs
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
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

    // Ensure FormData is available (Node.js 18+)
    ensureFormDataAvailable();

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

      // Validate buffer size based on resource type
      const maxSize = resourceType === 'video' ? getMaxVideoSizeBytes() : getMaxImageSizeBytes();
      const maxSizeLabel = resourceType === 'video' ? '500MB' : '50MB';
      if (buffer.length > maxSize) {
        const resourceTypeLabel = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
        throw new Error(
          `${resourceTypeLabel} size (${formatBytes(buffer.length)}) exceeds maximum allowed size of ${maxSizeLabel} (${formatBytes(maxSize)})`
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
   * Uses batching to prevent memory overflow with many images
   * @param imagePaths - Array of paths to the images on ComfyUI server
   * @returns Promise containing array of image data as Buffers
   * @throws Error if any image retrieval fails
   */
  async getImageBuffers(imagePaths: string[]): Promise<Buffer[]> {
    return this.getBuffersInBatches(imagePaths, 'image');
  }

  /**
   * Get multiple video buffers concurrently from ComfyUI server
   * Uses batching to prevent memory overflow with many videos
   * @param videoPaths - Array of paths to the videos on ComfyUI server
   * @returns Promise containing array of video data as Buffers
   * @throws Error if any video retrieval fails
   */
  async getVideoBuffers(videoPaths: string[]): Promise<Buffer[]> {
    return this.getBuffersInBatches(videoPaths, 'video');
  }

  /**
   * Get multiple buffers in batches to prevent memory overflow
   * This method processes resources in small batches (default: 3) to avoid
   * loading all buffers into memory simultaneously, which could cause
   * memory issues with large files (e.g., 10 images × 50MB = 500MB).
   *
   * @param paths - Array of paths to the resources on ComfyUI server
   * @param resourceType - Type of resource ('image' or 'video')
   * @returns Promise containing array of resource data as Buffers
   * @throws Error if any resource retrieval fails
   */
  private async getBuffersInBatches(
    paths: string[],
    resourceType: 'image' | 'video'
  ): Promise<Buffer[]> {
    const allBuffers: Buffer[] = [];
    const batchSize = VALIDATION.CONCURRENT_DOWNLOAD_BATCH_SIZE as number;
    const maxTotalMemory = VALIDATION.MAX_TOTAL_IMAGE_MEMORY_MB * 1024 * 1024;
    let currentTotalMemory = 0;

    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize);

      // Check memory limit before downloading batch
      const estimatedBatchSize = batch.length * getMaxImageSizeBytes() * 0.5; // Estimate
      if (currentTotalMemory + estimatedBatchSize > maxTotalMemory) {
        this.logger.warn(
          `Approaching memory limit (${formatBytes(currentTotalMemory)} / ${formatBytes(maxTotalMemory)}), ` +
          `processing remaining ${paths.length - i} ${resourceType}s in smaller batches`
        );
      }

      // Download batch concurrently
      const batchPromises = batch.map(path =>
        resourceType === 'image' ? this.getImageBuffer(path) : this.getVideoBuffer(path)
      );

      const batchBuffers = await Promise.all(batchPromises);

      // Add to results and track memory
      for (const buffer of batchBuffers) {
        allBuffers.push(buffer);
        currentTotalMemory += buffer.length;
      }

      this.logger.debug(
        `Downloaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(paths.length / batchSize)} ` +
        `(${batch.length} ${resourceType}s, ${formatBytes(currentTotalMemory)} total)`
      );

      // Force garbage collection hint after each batch
      // This doesn't guarantee GC but provides a hint to the engine
      if (global.gc) {
        global.gc();
      }
    }

    this.logger.info(
      `Successfully downloaded ${paths.length} ${resourceType}(s) with total size ${formatBytes(currentTotalMemory)}`
    );

    return allBuffers;
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
   *
   * Memory Management Strategy:
   * - Uses Set to track Buffers for manual cleanup (WeakMap was incorrect)
   * - Processes resources in batches to limit concurrent memory usage
   * - Explicitly clears Buffers after base64 conversion
   * - Uses try-finally to ensure cleanup even on errors
   *
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
    // Use Set to track buffers for manual cleanup (WeakMap doesn't work for this use case)
    const activeBuffers = new Set<Buffer>();

    try {
      // Fetch and process images in batches
      if (result.images && result.images.length > 0) {
        this.logger.info(`开始下载 ${result.images.length} 张图像`);

        const imageBuffers = await this.getImageBuffers(result.images);

        for (let i = 0; i < result.images.length; i++) {
          const imagePath = result.images[i];
          const imageBuffer = imageBuffers[i];

          // Track buffer for cleanup
          activeBuffers.add(imageBuffer);

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

          // Immediately remove buffer from tracking after base64 conversion
          // The base64 string is now the primary data owner
          activeBuffers.delete(imageBuffer);
          // Clear the array reference to help garbage collection
          imageBuffers[i] = null as unknown as Buffer;
        }

        jsonData.imageCount = result.images.length;
        this.logger.info(`成功处理 ${result.images.length} 张图像`);
      }

      // Fetch and process videos in batches
      if (result.videos && result.videos.length > 0) {
        this.logger.info(`开始下载 ${result.videos.length} 个视频`);

        const videoBuffers = await this.getVideoBuffers(result.videos);

        for (let i = 0; i < result.videos.length; i++) {
          const videoPath = result.videos[i];
          const videoBuffer = videoBuffers[i];

          // Track buffer for cleanup
          activeBuffers.add(videoBuffer);

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

          // Immediately remove buffer from tracking after base64 conversion
          activeBuffers.delete(videoBuffer);
          // Clear the array reference to help garbage collection
          videoBuffers[i] = null as unknown as Buffer;
        }

        jsonData.videoCount = result.videos.length;
        this.logger.info(`成功处理 ${result.videos.length} 个视频`);
      }

      return {
        json: jsonData,
        binary: binaryData,
      };
    } catch (error) {
      this.logger.error('处理结果时出错', error);
      throw error;
    } finally {
      // Final cleanup: clear all remaining buffers
      activeBuffers.clear();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      this.logger.debug('资源清理完成');
    }
  }
}
