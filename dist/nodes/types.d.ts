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
export type { ComfyUIClientConfig, WorkflowExecution, WorkflowResult } from './ComfyUiClient';
//# sourceMappingURL=types.d.ts.map