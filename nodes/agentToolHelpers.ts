/**
 * Agent Tool Helpers - Utility functions for AI Agent-friendly ComfyUI nodes
 *
 * This file contains helper functions for handling binary data and
 * generic workflow parameter updates, without making assumptions about
 * specific ComfyUI node types.
 *
 * @module agentToolHelpers
 */

import type { INodeExecutionData } from 'n8n-workflow';
import type { Workflow, BinaryData } from './types';

/**
 * Update a specific node's parameter in a workflow
 * @param workflow - ComfyUI workflow object
 * @param nodeId - The ID of the node to update
 * @param paramPath - The path to the parameter (e.g., 'inputs.text', 'inputs.seed')
 * @param value - The new value
 * @returns Updated workflow (new object, original is not mutated)
 *
 * @example
 * ```typescript
 * const updated = updateNodeParameter(workflow, '6', 'inputs.text', 'new prompt');
 * ```
 */
export function updateNodeParameter(
  workflow: Workflow,
  nodeId: string,
  paramPath: string,
  value: unknown
): Workflow {
  // Deep clone to avoid mutating original
  // Use structuredClone if available (Node.js 17+), fallback to JSON.parse/stringify
  let updatedWorkflow: Workflow;
  if (typeof structuredClone !== 'undefined') {
    updatedWorkflow = structuredClone(workflow);
  } else {
    updatedWorkflow = JSON.parse(JSON.stringify(workflow));
  }

  if (!updatedWorkflow[nodeId]) {
    throw new Error(`Node "${nodeId}" not found in workflow`);
  }

  // Navigate the path and set the value
  const pathParts = paramPath.split('.');
  let current: Record<string, unknown> = updatedWorkflow[nodeId] as unknown as Record<string, unknown>;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!(part in current)) {
      throw new Error(`Path "${paramPath}" does not exist in node "${nodeId}"`);
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = pathParts[pathParts.length - 1];
  current[lastPart] = value;

  return updatedWorkflow;
}

/**
 * Update multiple node parameters at once
 * @param workflow - ComfyUI workflow object
 * @param updates - Array of updates to apply
 * @returns Updated workflow
 *
 * @example
 * ```typescript
 * const updated = updateMultipleParameters(workflow, [
 *   { nodeId: '6', paramPath: 'inputs.text', value: 'prompt 1' },
 *   { nodeId: '3', paramPath: 'inputs.steps', value: 30 }
 * ]);
 * ```
 */
export function updateMultipleParameters(
  workflow: Workflow,
  updates: Array<{ nodeId: string; paramPath: string; value: unknown }>
): Workflow {
  let updatedWorkflow = workflow;

  for (const update of updates) {
    updatedWorkflow = updateNodeParameter(
      updatedWorkflow,
      update.nodeId,
      update.paramPath,
      update.value
    );
  }

  return updatedWorkflow;
}

/**
 * Set input image in a LoadImage node
 * @param workflow - ComfyUI workflow object
 * @param nodeId - The ID of the LoadImage node
 * @param imageFilename - The uploaded image filename
 * @returns Updated workflow
 *
 * @example
 * ```typescript
 * const updated = setLoadImageNode(workflow, '107', 'uploaded_image.png');
 * ```
 */
export function setLoadImageNode(
  workflow: Workflow,
  nodeId: string,
  imageFilename: string
): Workflow {
  return updateNodeParameter(workflow, nodeId, 'inputs.image', imageFilename);
}

/**
 * Extract binary data from input data
 * @param inputData - Input data from n8n
 * @param binaryKey - Binary property key (default: 'data')
 * @returns Binary data or null
 *
 * @example
 * ```typescript
 * const binaryData = extractBinaryData(inputData, 'data');
 * if (binaryData) {
 *   console.log('Got image:', binaryData.fileName);
 * }
 * ```
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
 * Get first binary key from input data
 * @param inputData - Input data from n8n
 * @returns First binary key or null
 *
 * @example
 * ```typescript
 * const key = getFirstBinaryKey(inputData);
 * console.log('Binary key:', key); // 'data' or 'image', etc.
 * ```
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
