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
  [key: string]: unknown; // Index signature for n8n compatibility
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface NetworkAddressInfo {
  isPrivate: boolean;
  isLocalhost: boolean;
}

// Node-level parameter configuration types
export interface NodeParameterConfig {
  nodeId: string;
  parameterMode?: 'multiple' | 'single'; // 参数模式：multiple 或 single
  parametersJson?: string;  // Multiple 模式：一次性配置多个参数
  paramName?: string;      // Single 模式：参数名
  value?: string;          // Single 模式：文本值
  numberValue?: number;    // Single 模式：数字值
  booleanValue?: string | boolean;  // Single 模式：布尔值
  binaryPropertyName?: string;  // Single 模式 Binary 类型：二进制属性名
  type?: 'text' | 'number' | 'boolean' | 'binary'; // Single 模式的类型
}

export interface NodeParameterInput {
  nodeParameter: NodeParameterConfig[];
}

// Workflow execution types
export interface WorkflowNodeInputs {
  [key: string]: unknown;
}

export interface NodeConnection {
  nodeId: string;
  slotIndex: number;
}

// Re-export from ComfyUiClient for convenience
export type { ComfyUIClientConfig, WorkflowExecution, WorkflowResult } from './ComfyUiClient';
