import { randomUUID } from 'crypto';
import { VALIDATION } from './constants';
import { IExecuteFunctions } from 'n8n-workflow';

export interface ComfyUIClientConfig {
  baseUrl: string;
  clientId?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  helpers: IExecuteFunctions['helpers'];
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
  private baseUrl: string;
  private timeout: number;
  private clientId: string;
  private maxRetries: number;
  private isDestroyed: boolean = false;

  constructor(config: ComfyUIClientConfig) {
    this.helpers = config.helpers;
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

  private generateClientId(): string {
    return `client_${randomUUID()}`;
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries: number = this.maxRetries,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (this.isDestroyed) {
          throw new Error('Client has been destroyed');
        }

        return await requestFn();
      } catch (error: any) {
        lastError = error;

        if (attempt < retries) {
          // Use a microtask to yield control between retries
          await Promise.resolve();
        }
      }
    }

    throw lastError;
  }

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

      // Debug: Log the request body
      console.log('[ComfyUI] Sending workflow to ComfyUI:', JSON.stringify(requestBody, null, 2));

      const response = await this.retryRequest(() =>
        this.helpers.httpRequest({
          method: 'POST',
          url: `${this.baseUrl}/prompt`,
          json: true,
          body: requestBody,
          timeout: this.timeout,
        }),
      );

      console.log('[ComfyUI] Response from ComfyUI:', JSON.stringify(response, null, 2));

      if (response.prompt_id) {
        return await this.waitForExecution(response.prompt_id);
      }

      return {
        success: false,
        error: 'Failed to execute workflow: No prompt_id returned',
      };
    } catch (error: any) {
      console.error('[ComfyUI] Workflow execution error:', error);
      console.error('[ComfyUI] Error details:', {
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

  private async waitForExecution(promptId: string, maxWaitTime: number = VALIDATION.MAX_WAIT_TIME_MS): Promise<WorkflowResult> {
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
      } catch (error: any) {
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

  async uploadImage(imageData: Buffer, filename: string, overwrite: boolean = false): Promise<string> {
    if (this.isDestroyed) {
      throw new Error('Client has been destroyed');
    }

    const response = await this.retryRequest(() =>
      this.helpers.httpRequest({
        method: 'POST',
        url: `${this.baseUrl}/upload/image`,
        body: {
          image: imageData,
          filename: filename,
          overwrite: overwrite,
        },
        json: true,
        timeout: this.timeout,
      } as any),
    );

    return response.name;
  }

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
}
