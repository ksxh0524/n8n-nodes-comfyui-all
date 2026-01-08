/**
 * Agent Tool Helpers - Utility functions for AI Agent-friendly ComfyUI nodes
 *
 * This file contains helper functions for parsing natural language queries
 * and updating ComfyUI workflows, designed to be used by agent-friendly nodes.
 */

import { randomInt } from 'crypto';
import type { INodeExecutionData } from 'n8n-workflow';
import {
  Workflow,
  ParsedParameters,
  ParameterPattern,
  ParameterExtractionResult,
  BinaryData,
} from './types';

// Parameter default values
export const DEFAULT_NEGATIVE_PROMPT = 'ugly, blurry, low quality, distorted';
export const DEFAULT_WIDTH = 512;
export const DEFAULT_HEIGHT = 512;
export const DEFAULT_STEPS = 20;
export const DEFAULT_CFG = 8;

// Maximum random seed value (32-bit signed integer max value)
export const MAX_SEED_VALUE = 2147483647;

// Parameter extraction rules configuration
export const PARAM_PATTERNS: Record<string, ParameterPattern> = {
  negative: {
    regex: /(?<=\s|,|，|^)negative:\s*([^\n]+)/i,
    paramKey: 'negative_prompt',
    parser: (match: RegExpMatchArray) => match[1].trim()
  },
  size: {
    regex: /(?<=\s|,|，|^)size:\s*(\d+)x(\d+)/i,
    paramKeys: ['width', 'height'],
    parser: (match: RegExpMatchArray) => ({
      width: parseInt(match[1]),
      height: parseInt(match[2])
    })
  },
  steps: {
    regex: /(?<=\s|,|，|^)steps:\s*(\d+)/i,
    paramKey: 'steps',
    parser: (match: RegExpMatchArray) => parseInt(match[1])
  },
  cfg: {
    regex: /(?<=\s|,|，|^)cfg:\s*([\d.]+)/i,
    paramKey: 'cfg',
    parser: (match: RegExpMatchArray) => parseFloat(match[1])
  },
  seed: {
    regex: /(?<=\s|,|，|^)seed:\s*(\d+)/i,
    paramKey: 'seed',
    parser: (match: RegExpMatchArray) => parseInt(match[1])
  }
};

/**
 * Extract parameter from query
 * @param query - User query text
 * @param pattern - Parameter pattern configuration
 * @returns Extracted parameter and cleaned query
 */
export function extractParameter(query: string, pattern: ParameterPattern): ParameterExtractionResult {
  const match = query.match(pattern.regex);
  if (!match) {
    return { value: null, cleanedQuery: query };
  }

  const value = pattern.parser(match);
  const cleanedQuery = query.replace(pattern.regex, '').trim();

  return { value, cleanedQuery };
}

/**
 * Parse user input to extract image generation parameters
 * @param query - User query text
 * @param defaults - Default parameter values
 * @returns Parsed parameters object
 */
export function parseInput(query: string, defaults: {
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
} = {}): ParsedParameters {
  const params: ParsedParameters = {
    prompt: '',
    negative_prompt: defaults.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
    width: defaults.width || DEFAULT_WIDTH,
    height: defaults.height || DEFAULT_HEIGHT,
    steps: defaults.steps || DEFAULT_STEPS,
    cfg: defaults.cfg || DEFAULT_CFG,
    seed: randomInt(0, MAX_SEED_VALUE)
  };

  let currentQuery = query.trim();

  // Extract parameters using patterns
  for (const [, pattern] of Object.entries(PARAM_PATTERNS)) {
    const { value, cleanedQuery } = extractParameter(currentQuery, pattern);

    if (value !== null) {
      if (pattern.paramKeys) {
        // Type guard: check if value is an object with keys
        if (typeof value === 'object' && value !== null) {
          const valueRecord = value as Record<string, unknown>;
          const valueKeys = Object.keys(valueRecord);
          pattern.paramKeys.forEach((key, index) => {
            (params as Record<string, unknown>)[key] = valueRecord[valueKeys[index]];
          });
        }
      } else if (pattern.paramKey) {
        (params as Record<string, unknown>)[pattern.paramKey] = value;
      }
      currentQuery = cleanedQuery;
    }
  }

  // Clean up remaining parameter markers and extra punctuation
  currentQuery = currentQuery
    .replace(/，\s*，/g, '，') // Remove consecutive Chinese commas
    .replace(/,\s*,/g, ',') // Remove consecutive English commas
    .replace(/[，,]\s*[，,]/g, ' ') // Remove extra spaces between commas
    .replace(/^\s*[，,]+/g, '') // Remove all leading commas
    .replace(/[，,]+\s*$/g, '') // Remove all trailing commas
    .trim();

  params.prompt = currentQuery;

  return params;
}

/**
 * Find node ID by node type
 * @param workflow - Workflow object
 * @param classType - Node type
 * @returns Node ID or null
 */
export function findNodeByClassType(workflow: Workflow, classType: string): string | null {
  for (const nodeId in workflow) {
    if (workflow[nodeId] && workflow[nodeId].class_type === classType) {
      return nodeId;
    }
  }
  return null;
}

/**
 * Update workflow parameters
 * @param workflow - ComfyUI workflow object
 * @param params - Parameters object
 * @returns Updated workflow
 */
export function updateWorkflow(workflow: Workflow, params: ParsedParameters): Workflow {
  const updatedWorkflow: Workflow = JSON.parse(JSON.stringify(workflow));

  // Find and update positive and negative prompt nodes
  const clipTextEncodeNodes: string[] = [];
  for (const nodeId in updatedWorkflow) {
    if (updatedWorkflow[nodeId] && updatedWorkflow[nodeId].class_type === 'CLIPTextEncode') {
      clipTextEncodeNodes.push(nodeId);
    }
  }

  if (clipTextEncodeNodes.length >= 1) {
    updatedWorkflow[clipTextEncodeNodes[0]].inputs.text = params.prompt;
  }
  if (clipTextEncodeNodes.length >= 2) {
    updatedWorkflow[clipTextEncodeNodes[1]].inputs.text = params.negative_prompt;
  }

  // Find and update image size node (for text-to-image)
  const latentNodeId = findNodeByClassType(updatedWorkflow, 'EmptyLatentImage') ||
                      findNodeByClassType(updatedWorkflow, 'EmptySD3LatentImage');
  if (latentNodeId && updatedWorkflow[latentNodeId].inputs) {
    updatedWorkflow[latentNodeId].inputs.width = params.width;
    updatedWorkflow[latentNodeId].inputs.height = params.height;
  }

  // Find and update sampling parameters node
  const samplerNodeId = findNodeByClassType(updatedWorkflow, 'KSampler');
  if (samplerNodeId && updatedWorkflow[samplerNodeId].inputs) {
    updatedWorkflow[samplerNodeId].inputs.steps = params.steps;
    updatedWorkflow[samplerNodeId].inputs.cfg = params.cfg;
    updatedWorkflow[samplerNodeId].inputs.seed = params.seed;
  }

  // Find and update edit instruction node (for image editing workflows)
  const primitiveNodeId = findNodeByClassType(updatedWorkflow, 'PrimitiveStringMultiline');
  if (primitiveNodeId && updatedWorkflow[primitiveNodeId].inputs) {
    updatedWorkflow[primitiveNodeId].inputs.value = params.prompt;
  }

  return updatedWorkflow;
}

/**
 * Update workflow with uploaded image filename
 * @param workflow - ComfyUI workflow object
 * @param imageFilename - Uploaded image filename
 * @returns Updated workflow
 */
export function updateWorkflowWithImage(workflow: Workflow, imageFilename: string): Workflow {
  const updatedWorkflow: Workflow = JSON.parse(JSON.stringify(workflow));

  // Find LoadImage node and update the image filename
  const loadImageNodeId = findNodeByClassType(updatedWorkflow, 'LoadImage');
  if (loadImageNodeId && updatedWorkflow[loadImageNodeId].inputs) {
    updatedWorkflow[loadImageNodeId].inputs.image = imageFilename;
    updatedWorkflow[loadImageNodeId].inputs.upload = 'image';
  }

  return updatedWorkflow;
}

/**
 * Extract binary data from input data
 * @param inputData - Input data from n8n
 * @param binaryKey - Binary property key (default: 'data')
 * @returns Binary data or null
 */
export function extractBinaryData(inputData: INodeExecutionData[], binaryKey: string = 'data'): BinaryData | null {
  if (!inputData || !Array.isArray(inputData) || inputData.length === 0) {
    return null;
  }

  const firstItem = inputData[0];
  if (!firstItem || !firstItem.binary || !firstItem.binary[binaryKey]) {
    return null;
  }

  return firstItem.binary[binaryKey] as BinaryData;
}

/**
 * Check if input contains binary image data
 * @param inputData - Input data from n8n
 * @returns True if binary data is present
 */
export function hasBinaryData(inputData: INodeExecutionData[]): boolean {
  if (!inputData || !Array.isArray(inputData) || inputData.length === 0) {
    return false;
  }

  const firstItem = inputData[0];
  if (!firstItem || !firstItem.binary) {
    return false;
  }

  // Check if any binary key exists
  const binaryKeys = Object.keys(firstItem.binary);
  return binaryKeys.length > 0;
}

/**
 * Get first binary key from input data
 * @param inputData - Input data from n8n
 * @returns First binary key or null
 */
export function getFirstBinaryKey(inputData: INodeExecutionData[]): string | null {
  if (!inputData || !Array.isArray(inputData) || inputData.length === 0) {
    return null;
  }

  const firstItem = inputData[0];
  if (!firstItem || !firstItem.binary) {
    return null;
  }

  const binaryKeys = Object.keys(firstItem.binary);
  return binaryKeys.length > 0 ? binaryKeys[0] : null;
}

