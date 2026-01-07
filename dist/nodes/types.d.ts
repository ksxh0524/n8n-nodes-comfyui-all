/**
 * Type definitions for ComfyUI n8n nodes
 */
export interface WorkflowOptions {
    modelName?: string;
    denoise?: number;
    frames?: number;
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    samplerName?: string;
    scheduler?: string;
}
export interface WorkflowNode {
    inputs?: Record<string, unknown>;
    class_type: string;
    _meta?: Record<string, unknown>;
}
export interface ComfyUIWorkflow {
    prompt: Record<string, WorkflowNode>;
    extra_data?: Record<string, unknown>;
}
export interface ImageOutput {
    url?: string;
    data?: string;
    type: 'image';
}
export interface VideoOutput {
    url?: string;
    data?: string;
    type: 'video';
}
export interface NodeExecutionOutput {
    success: boolean;
    operation?: string;
    images?: ImageOutput[];
    videos?: VideoOutput[];
    [key: string]: unknown;
}
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export interface NetworkAddressInfo {
    isPrivate: boolean;
    isLocalhost: boolean;
}
export interface NodeParameterConfig {
    nodeId: string;
    parameterMode?: 'multiple' | 'single';
    parametersJson?: string;
    paramName?: string;
    value?: string;
    numberValue?: number;
    booleanValue?: string | boolean;
    imageSource?: 'binary' | 'url';
    imageUrl?: string;
    type?: 'text' | 'number' | 'boolean' | 'image';
}
export interface NodeParameterInput {
    nodeParameter: NodeParameterConfig[];
}
export interface WorkflowNodeInputs {
    [key: string]: unknown;
}
export interface NodeConnection {
    nodeId: string;
    slotIndex: number;
}
export type { ComfyUIClientConfig, WorkflowExecution, WorkflowResult } from './ComfyUiClient';
//# sourceMappingURL=types.d.ts.map