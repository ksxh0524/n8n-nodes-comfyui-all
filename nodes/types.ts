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
  booleanValue?: string | boolean;
  imageSource?: 'binary' | 'url';
  imageUrl?: string;
  type?: 'text' | 'number' | 'boolean' | 'image';
}

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
  [key: string]: unknown; // Allow dynamic properties
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
  [key: string]: string; // Index signature for n8n compatibility
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
