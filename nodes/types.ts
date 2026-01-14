/**
 * Type definitions for ComfyUI n8n nodes
 */

import type { IDataObject } from 'n8n-workflow';

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
  parameterMode?: 'multiple' | 'single';
  parametersJson?: string;
  paramName?: string;
  value?: string;
  numberValue?: number;
  /**
   * Boolean value - accepts both string ('true'/'false') and boolean
   * Will be normalized to native boolean internally
   */
  booleanValue?: Booleanish;
  imageSource?: 'binary' | 'url';
  imageUrl?: string;
  type?: 'text' | 'number' | 'boolean' | 'image';
}

/**
 * Boolean value type - accepts string or boolean for flexibility
 * String values are strictly parsed (only 'true' is truthy)
 */
export type Booleanish = 'true' | 'false' | boolean;

export interface NodeParameterInput {
  nodeParameter: NodeParameterConfig[];
}

// ComfyUI workflow types
export interface WorkflowNode {
  inputs: Record<string, unknown>;
  class_type: string;
}

export interface PromptResponse {
  prompt_id: string;
}

/**
 * ComfyUI node error details
 */
export interface ComfyUINodeError {
  type: string;
  message: string;
  details?: string;
  exception_type?: string;
}

export interface HistoryResponse {
  [key: string]: {
    outputs?: unknown;
    status?: {
      completed: boolean;
      status_str?: string;
    };
    node_errors?: Record<string, { errors: ComfyUINodeError[] }>;
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

// Re-export from ComfyUiClient for convenience
export type { ComfyUIClientConfig, WorkflowExecution, WorkflowResult } from './ComfyUiClient';

// HTTP Error interface for better type safety
export interface HttpError extends Error {
  code?: string;
  response?: {
    statusCode: number;
    statusMessage: string;
    body?: unknown;
    data?: unknown;
  };
  statusCode?: number;
  statusMessage?: string;
}

/**
 * ComfyUI node output types
 */
export interface NodeOutput {
  images?: Array<{
    filename: string;
    subfolder?: string;
    type: string;
  }>;
  videos?: Array<{
    filename: string;
    subfolder?: string;
    type: string;
  }>;
  gifs?: Array<{
    filename: string;
    subfolder?: string;
    type: string;
  }>;
}

/**
 * Workflow outputs mapping
 */
export interface WorkflowOutputs {
  [nodeId: string]: NodeOutput;
}

/**
 * Binary data structure for n8n output
 */
export interface BinaryData {
  data: string;
  mimeType: string;
  fileName: string;
  fileSize?: string; // File size in bytes as string (helps with preview)
  fileExtension?: string; // File extension (helps with preview)
  [key: string]: string | undefined; // Index signature for n8n compatibility
}

/**
 * JSON data structure for n8n output
 */
export interface JsonData extends IDataObject {
  success: true;
  data?: Record<string, unknown>;
  images?: string[];
  imageUrls?: string[];
  videos?: string[];
  videoUrls?: string[];
  imageCount?: number;
  videoCount?: number;
}

/**
 * Process output result from client
 */
export interface ProcessOutput {
  json: JsonData;
  binary: Record<string, BinaryData>;
}
