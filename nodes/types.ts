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

// Node-level parameter configuration types
export interface NodeParameterConfig {
  nodeId: string;
  parameterMode?: 'multiple' | 'single'; // 参数模式：multiple 或 single
  parametersJson?: string;  // Multiple 模式：一次性配置多个参数
  paramName?: string;      // Single 模式：参数名
  value?: string;          // Single 模式：文本值
  numberValue?: number;    // Single 模式：数字值
  booleanValue?: string | boolean;  // Single 模式：布尔值
  imageSource?: 'binary' | 'url'; // Image 类型：数据来源
  imageUrl?: string;       // Image 类型：图片 URL
  type?: 'text' | 'number' | 'boolean' | 'image'; // Single 模式的类型
}

export interface NodeParameterInput {
  nodeParameter: NodeParameterConfig[];
}

// Re-export from ComfyUiClient for convenience
export type { ComfyUIClientConfig, WorkflowExecution, WorkflowResult } from './ComfyUiClient';
