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
    private generateClientId;
    private retryRequest;
    executeWorkflow(workflow: Record<string, WorkflowNode>): Promise<WorkflowResult>;
    private preparePrompt;
    private waitForExecution;
    private extractResults;
    getHistory(limit?: number): Promise<Record<string, unknown>>;
    uploadImage(imageData: Buffer, filename: string, overwrite?: boolean): Promise<string>;
    getSystemInfo(): Promise<Record<string, unknown>>;
    getImageBuffer(imagePath: string): Promise<Buffer>;
    getVideoBuffer(videoPath: string): Promise<Buffer>;
    /**
     * Format error message with additional context
     */
    private formatErrorMessage;
}
//# sourceMappingURL=ComfyUiClient.d.ts.map