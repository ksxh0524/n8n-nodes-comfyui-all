import { ValidationResult } from './types';

const MAX_JSON_SIZE = 1 * 1024 * 1024;
const MAX_JSON_DEPTH = 100;

/**
 * Calculate object depth using iteration to prevent stack overflow on large objects
 * @param obj - Object to calculate depth for
 * @param maxDepth - Maximum depth to calculate (default: 100)
 * @returns Object depth or maxDepth if exceeded
 */
function getObjectDepth(obj: unknown, maxDepth: number = MAX_JSON_DEPTH): number {
  if (typeof obj !== 'object' || obj === null) {
    return 1;
  }

  // Use iterative approach with a stack to avoid recursion stack overflow
  const stack: Array<{ value: unknown; depth: number }> = [{ value: obj, depth: 1 }];
  let calculatedMaxDepth = 1;

  while (stack.length > 0) {
    const { value, depth } = stack.pop()!;

    // Update max depth
    if (depth > calculatedMaxDepth) {
      calculatedMaxDepth = depth;
    }

    // Early termination if max depth exceeded
    if (calculatedMaxDepth > maxDepth) {
      return calculatedMaxDepth;
    }

    // Skip if not an object or null
    if (typeof value !== 'object' || value === null) {
      continue;
    }

    // Don't go deeper than maxDepth
    if (depth >= maxDepth) {
      continue;
    }

    // Add children to stack
    const nextDepth = depth + 1;
    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push({ value: item, depth: nextDepth });
      }
    } else {
      for (const item of Object.values(value)) {
        stack.push({ value: item, depth: nextDepth });
      }
    }
  }

  return calculatedMaxDepth;
}

export function safeJsonParse(jsonString: string, context: string = 'JSON'): unknown {
  if (typeof jsonString !== 'string') {
    throw new Error(`${context} must be a string`);
  }

  if (jsonString.length === 0) {
    throw new Error(`${context} is empty`);
  }

  if (jsonString.length > MAX_JSON_SIZE) {
    throw new Error(`${context} exceeds maximum size of ${MAX_JSON_SIZE / 1024 / 1024}MB (actual: ${(jsonString.length / 1024 / 1024).toFixed(2)}MB)`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} is invalid: ${errorMessage}`);
  }

  const depth = getObjectDepth(parsed);
  if (depth > MAX_JSON_DEPTH) {
    throw new Error(`${context} exceeds maximum depth of ${MAX_JSON_DEPTH} (actual: ${depth})`);
  }

  return parsed;
}

/**
 * Validate if a string is a valid HTTP/HTTPS URL
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate if a JSON string is a valid ComfyUI API format workflow
 */
export function validateComfyUIWorkflow(workflowJson: string): ValidationResult {
  if (!workflowJson || workflowJson.trim() === '') {
    return {
      valid: false,
      error: 'Workflow JSON is empty',
    };
  }

  let workflow: Record<string, unknown>;
  try {
    workflow = safeJsonParse(workflowJson, 'Workflow JSON') as Record<string, unknown>;
  } catch (error: unknown) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof workflow !== 'object' || workflow === null || Array.isArray(workflow)) {
    return {
      valid: false,
      error: 'Workflow must be an object with node IDs as keys',
    };
  }

  const nodeIds = Object.keys(workflow);
  if (nodeIds.length === 0) {
    return {
      valid: false,
      error: 'Workflow must contain at least one node',
    };
  }

  for (const nodeId of nodeIds) {
    const node = workflow[nodeId];

    if (typeof node !== 'object' || node === null) {
      return {
        valid: false,
        error: `Node ${nodeId} must be an object`,
      };
    }

    const nodeObj = node as Record<string, unknown>;

    if (!nodeObj.class_type || typeof nodeObj.class_type !== 'string') {
      return {
        valid: false,
        error: `Node ${nodeId} must have a class_type property`,
      };
    }

    if (nodeObj.inputs !== undefined) {
      if (typeof nodeObj.inputs !== 'object' || nodeObj.inputs === null || Array.isArray(nodeObj.inputs)) {
        return {
          valid: false,
          error: `Node ${nodeId} inputs must be an object`,
        };
      }
    }

    if (nodeObj.widgets_values !== undefined) {
      if (!Array.isArray(nodeObj.widgets_values)) {
        return {
          valid: false,
          error: `Node ${nodeId} widgets_values must be an array`,
        };
      }
    }
  }

  return { valid: true };
}
