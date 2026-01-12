/**
 * Workflow Configuration Utilities
 *
 * This module provides utilities for handling ComfyUI workflows.
 * All workflows must be provided by the user - there are no built-in templates.
 */

import { Workflow } from './types';
import { safeJsonParse } from './validation';

/**
 * Validate and parse user-provided workflow JSON
 * @param workflowJson - Workflow JSON string or object
 * @returns Parsed workflow object
 * @throws Error if workflow is invalid
 */
export function parseWorkflow(workflowJson: string | Workflow): Workflow {
  if (typeof workflowJson === 'string') {
    if (!workflowJson.trim()) {
      throw new Error('工作流 JSON 为空。请提供有效的 ComfyUI 工作流。');
    }
    return safeJsonParse(workflowJson, 'Workflow JSON') as Workflow;
  }

  if (typeof workflowJson === 'object' && workflowJson !== null) {
    if (Object.keys(workflowJson).length === 0) {
      throw new Error('Workflow object is empty. Please provide a valid ComfyUI workflow.');
    }
    return workflowJson as Workflow;
  }

  throw new Error('Invalid workflow format. Expected JSON string or object.');
}

/**
 * Check if a workflow has a specific node type
 * @param workflow - ComfyUI workflow object
 * @param classType - Node class type to search for
 * @returns Array of node IDs that match the class type
 */
export function findNodesByClassType(workflow: Workflow, classType: string): string[] {
  const matchingNodes: string[] = [];

  for (const nodeId in workflow) {
    if (workflow[nodeId] && workflow[nodeId].class_type === classType) {
      matchingNodes.push(nodeId);
    }
  }

  return matchingNodes;
}

/**
 * Get all node IDs from a workflow
 * @param workflow - ComfyUI workflow object
 * @returns Array of node IDs
 */
export function getAllNodeIds(workflow: Workflow): string[] {
  return Object.keys(workflow);
}

/**
 * Get all class types used in a workflow
 * @param workflow - ComfyUI workflow object
 * @returns Array of unique class types
 */
export function getWorkflowClassTypes(workflow: Workflow): string[] {
  const classTypes = new Set<string>();

  for (const nodeId in workflow) {
    if (workflow[nodeId] && workflow[nodeId].class_type) {
      classTypes.add(workflow[nodeId].class_type);
    }
  }

  return Array.from(classTypes);
}