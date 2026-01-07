import { IExecuteFunctions } from 'n8n-workflow';
import { Logger } from './logger';
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
export declare class ComfyUIClient {
    private helpers;
    private logger;
    private baseUrl;
    private timeout;
    private clientId;
    private maxRetries;
    private isDestroyed;
    private abortController;
    constructor(config: ComfyUIClientConfig);
    /**
     * Cancel any ongoing request and clean up resources
     */
    cancelRequest(): void;
    /**
     * Clean up resources when the client is no longer needed
     */
    destroy(): void;
    /**
     * Check if the client has been destroyed
     */
    isClientDestroyed(): boolean;
    /**
     * Generate a unique client ID
     * @returns Unique client ID string
     */
    private generateClientId;
    /**
     * Delay execution for a specified time
     * @param ms - Delay time in milliseconds
     * @returns Promise that resolves after the delay
     */
    private delay;
    /**
     * Retry a request with exponential backoff
     * @param requestFn - Function that returns a Promise to retry
     * @param retries - Maximum number of retry attempts
     * @returns Promise that resolves when the request succeeds
     * @throws Error if all retry attempts fail
     */
    private retryRequest;
    /**
     * Execute a ComfyUI workflow
     * @param workflow - Workflow object containing nodes and their configurations
     * @returns Promise containing workflow execution result
     */
    executeWorkflow(workflow: Record<string, WorkflowNode>): Promise<WorkflowResult>;
    /**
     * Prepare workflow prompt for ComfyUI API
     * @param workflow - Workflow object containing nodes
     * @returns Formatted prompt object
     */
    private preparePrompt;
    /**
     * Wait for workflow execution to complete
     * @param promptId - Prompt ID from ComfyUI
     * @param maxWaitTime - Maximum time to wait in milliseconds
     * @returns Promise containing workflow execution result
     */
    private waitForExecution;
    /**
     * Extract image and video results from workflow outputs
     * @param outputs - Raw output data from ComfyUI
     * @returns WorkflowResult with extracted images and videos
     */
    private extractResults;
    /**
     * Get execution history from ComfyUI
     * @param limit - Maximum number of history entries to retrieve
     * @returns Promise containing history data
     */
    getHistory(limit?: number): Promise<Record<string, unknown>>;
    /**
     * Upload an image to ComfyUI server
     * @param imageData - Image data as Buffer
     * @param filename - Name of the file to upload
     * @param overwrite - Whether to overwrite existing file
     * @returns Promise containing the uploaded filename
     * @throws Error if image data is invalid or upload fails
     */
    uploadImage(imageData: Buffer, filename: string, overwrite?: boolean): Promise<string>;
    /**
     * Get system information from ComfyUI server
     * @returns Promise containing system stats
     */
    getSystemInfo(): Promise<Record<string, unknown>>;
    /**
     * Get image buffer from ComfyUI server
     * @param imagePath - Path to the image on ComfyUI server
     * @returns Promise containing image data as Buffer
     * @throws Error if image retrieval fails
     */
    getImageBuffer(imagePath: string): Promise<Buffer>;
    /**
     * Get video buffer from ComfyUI server
     * @param videoPath - Path to the video on ComfyUI server
     * @returns Promise containing video data as Buffer
     * @throws Error if video retrieval fails
     */
    getVideoBuffer(videoPath: string): Promise<Buffer>;
    /**
     * Format error message with additional context
     */
    private formatErrorMessage;
    /**
     * Process workflow execution results and format them for n8n output
     * @param result - Workflow execution result
     * @param outputBinaryKey - Property name for the first output binary data
     * @returns Processed result with json and binary data
     */
    processResults(result: WorkflowResult, outputBinaryKey?: string): Promise<{
        json: Record<string, any>;
        binary: Record<string, any>;
    }>;
}
//# sourceMappingURL=ComfyUiClient.d.ts.map