/**
 * Type definitions for ComfyUI n8n nodes
 */
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
export interface WorkflowNode {
    inputs: Record<string, unknown>;
    class_type: string;
}
export interface PromptResponse {
    prompt_id: string;
}
export interface HistoryResponse {
    [key: string]: {
        outputs?: unknown;
        status?: {
            completed: boolean;
        };
    };
}
export interface Workflow {
    [nodeId: string]: WorkflowNode;
}
export interface ImageInfo {
    filename: string;
    subfolder: string;
    type: string;
    url: string;
}
export interface ParsedParameters {
    prompt: string;
    negative_prompt: string;
    width: number;
    height: number;
    steps: number;
    cfg: number;
    seed: number;
    [key: string]: unknown;
}
export interface ParameterPattern {
    regex: RegExp;
    paramKey?: string;
    paramKeys?: string[];
    parser: (match: RegExpMatchArray) => unknown;
}
export interface ToolInputOptions {
    comfyUiUrl?: string;
    workflowConfig?: WorkflowConfig;
}
export interface WorkflowConfig {
    template?: Workflow;
    customTemplate?: string;
}
export interface ToolResult {
    success: boolean;
    message?: string;
    error?: string;
    data?: {
        prompt: string;
        images: string[];
        parameters: ParsedParameters;
    };
}
export interface ParameterExtractionResult {
    value: unknown;
    cleanedQuery: string;
}
export type { ComfyUIClientConfig, WorkflowExecution, WorkflowResult } from './ComfyUiClient';
//# sourceMappingURL=types.d.ts.map