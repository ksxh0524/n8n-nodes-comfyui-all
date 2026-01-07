/**
 * ComfyUI Agent Tool - Custom Code Tool for n8n AI Agent
 *
 * This tool allows AI Agents to directly call ComfyUI API to generate images
 *
 * Usage:
 * 1. Create a "Custom Code Tool" node in n8n
 * 2. Copy this code into the JavaScript code box
 * 3. Fill in the Description: Generates images using ComfyUI. Use this tool when the user asks to create, generate, or make images.
 * 4. Add this tool to the tools list of the AI Agent node
 */

import axios from 'axios';
import { randomInt } from 'crypto';
import {
  PromptResponse,
  HistoryResponse,
  Workflow,
  ImageInfo,
  ParsedParameters,
  ParameterPattern,
  ToolInputOptions,
  ToolResult,
  ParameterExtractionResult
} from '../nodes/types';
import { getWorkflowTemplate } from '../nodes/workflowConfig';

// Logger interface and implementation
interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

class ConsoleLogger implements ILogger {
  private prefix: string;

  constructor(prefix: string = '[ComfyUI Tool]') {
    this.prefix = prefix;
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.log(`${this.prefix} ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    console.log(`${this.prefix} ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix} ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`${this.prefix} ${message}`, ...args);
  }
}

// Create logger instance
const logger = new ConsoleLogger('[ComfyUI Tool]');

// Default configuration
const DEFAULT_COMFYUI_URL = 'http://127.0.0.1:8188';

// Parameter default values
const DEFAULT_NEGATIVE_PROMPT = 'ugly, blurry, low quality, distorted';
const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 512;
const DEFAULT_STEPS = 20;
const DEFAULT_CFG = 8;

// Maximum random seed value (32-bit signed integer max value)
const MAX_SEED_VALUE = 2147483647;

// Polling configuration
const POLLING_MAX_ATTEMPTS = 120; // Maximum wait time of 2 minutes (120 seconds)
const POLLING_INTERVAL_MS = 1000; // Polling interval of 1 second

// Request timeout configuration
const QUEUE_REQUEST_TIMEOUT = 30000; // Queue request timeout 30 seconds
const HISTORY_REQUEST_TIMEOUT = 10000; // History request timeout 10 seconds

/**
 * Promise-based delay function
 * @param ms - Delay time in milliseconds
 * @returns Promise object
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parameter extraction rules configuration
const PARAM_PATTERNS: Record<string, ParameterPattern> = {
  negative: {
    regex: /negative:\s*([^\n]+)/i,
    paramKey: 'negative_prompt',
    parser: (match: RegExpMatchArray) => match[1].trim()
  },
  size: {
    regex: /size:\s*(\d+)x(\d+)/i,
    paramKeys: ['width', 'height'],
    parser: (match: RegExpMatchArray) => ({
      width: parseInt(match[1]),
      height: parseInt(match[2])
    })
  },
  steps: {
    regex: /steps:\s*(\d+)/i,
    paramKey: 'steps',
    parser: (match: RegExpMatchArray) => parseInt(match[1])
  },
  cfg: {
    regex: /cfg:\s*([\d.]+)/i,
    paramKey: 'cfg',
    parser: (match: RegExpMatchArray) => parseFloat(match[1])
  },
  seed: {
    regex: /seed:\s*(\d+)/i,
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
function extractParameter(query: string, pattern: ParameterPattern): ParameterExtractionResult {
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
 * @returns Parsed parameters object
 */
function parseInput(query: string): ParsedParameters {
  const params: ParsedParameters = {
    prompt: '',
    negative_prompt: DEFAULT_NEGATIVE_PROMPT,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    steps: DEFAULT_STEPS,
    cfg: DEFAULT_CFG,
    seed: randomInt(0, MAX_SEED_VALUE)
  };

  let currentQuery = query.trim();

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
function findNodeByClassType(workflow: Workflow, classType: string): string | null {
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
function updateWorkflow(workflow: Workflow, params: ParsedParameters): Workflow {
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

  // Find and update image size node
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
 * Extract image information from output nodes
 * @param outputs - ComfyUI output object
 * @param url - ComfyUI server URL
 * @returns Array of image information
 */
function extractImagesFromOutputs(outputs: Record<string, unknown>, url: string): ImageInfo[] {
  const images: ImageInfo[] = [];

  for (const nodeId in outputs) {
    const nodeOutput = outputs[nodeId];
    if (!nodeOutput || typeof nodeOutput !== 'object') {
      continue;
    }

    const nodeImages = (nodeOutput as any).images;
    if (!nodeImages) {
      continue;
    }

    if (!Array.isArray(nodeImages) || nodeImages.length === 0) {
      continue;
    }

    for (const image of nodeImages) {
      const imageInfo = processImage(image, nodeId, url);
      if (imageInfo) {
        images.push(imageInfo);
      }
    }
  }

  return images;
}

/**
 * Process single image object
 * @param image - Image object
 * @param nodeId - Node ID
 * @param url - ComfyUI server URL
 * @returns Processed image information or null
 */
function processImage(image: unknown, nodeId: string, url: string): ImageInfo | null {
  if (!image || typeof image !== 'object') {
    logger.warn(`Invalid image object in node ${nodeId}`);
    return null;
  }

  const imageObj = image as Record<string, unknown>;
  const filename = imageObj.filename as string | undefined;
  const subfolder = (imageObj.subfolder as string | undefined) || '';
  const type = (imageObj.type as string | undefined) || 'output';

  if (!filename) {
    logger.warn(`Image missing filename in node ${nodeId}`);
    return null;
  }

  return {
    filename: filename,
    subfolder: subfolder,
    type: type,
    url: `${url}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`
  };
}

/**
 * Execute ComfyUI workflow
 * @param workflow - ComfyUI workflow object
 * @param comfyUiUrl - ComfyUI server URL
 */
async function executeComfyUIWorkflow(workflow: Workflow, comfyUiUrl?: string): Promise<{
  success: boolean;
  prompt_id: string;
  images: ImageInfo[];
}> {
  const url = comfyUiUrl || DEFAULT_COMFYUI_URL;

  // 1. Queue prompt
  let promptResponse;
  try {
    promptResponse = await axios.post<PromptResponse>(`${url}/prompt`, {
      prompt: workflow
    }, {
      timeout: QUEUE_REQUEST_TIMEOUT
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      const errorCode = (error as any).code;
      if (errorCode === 'ECONNREFUSED') {
        throw new Error(`Failed to connect to ComfyUI server at ${url}. Please check if the server is running.`);
      } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNABORTED') {
        throw new Error(`Connection timeout while connecting to ComfyUI server at ${url}.`);
      } else if ((error as any).response) {
        throw new Error(`ComfyUI server returned error: ${(error as any).response.status} ${(error as any).response.statusText}`);
      } else {
        throw new Error(`Failed to queue workflow: ${error.message}`);
      }
    }
    throw new Error(`Failed to queue workflow: ${String(error)}`);
  }

  if (!promptResponse.data || !promptResponse.data.prompt_id) {
    throw new Error('Invalid response from ComfyUI server: missing prompt_id');
  }

  const promptId = promptResponse.data.prompt_id;
  logger.info(`Workflow queued with ID: ${promptId}`);

  // 2. Poll for results
  let attempts = 0;

  while (attempts < POLLING_MAX_ATTEMPTS) {
    await delay(POLLING_INTERVAL_MS);

    // Check history
    let historyResponse;
    try {
      historyResponse = await axios.get<HistoryResponse>(`${url}/history/${promptId}`, {
        timeout: HISTORY_REQUEST_TIMEOUT
      });
    } catch (error: unknown) {
      const errorCode = error instanceof Error ? (error as any).code : undefined;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorCode === 'ECONNREFUSED') {
        throw new Error(`Lost connection to ComfyUI server at ${url}.`);
      } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNABORTED') {
        logger.warn(`Timeout checking history (attempt ${attempts + 1}/${POLLING_MAX_ATTEMPTS})`);
        attempts++;
        continue;
      } else {
        logger.warn(`Error checking history: ${errorMessage}`);
        attempts++;
        continue;
      }
    }

    if (historyResponse.data && historyResponse.data[promptId]) {
      const outputs = historyResponse.data[promptId].outputs as Record<string, unknown> | undefined;

      if (outputs) {
        const images = extractImagesFromOutputs(outputs, url);

        if (images.length === 0) {
          throw new Error('Workflow completed but no images were generated');
        }

        return {
          success: true,
          prompt_id: promptId,
          images: images
        };
      }
    }

    attempts++;
  }

  throw new Error(`Workflow execution timeout after ${POLLING_MAX_ATTEMPTS} seconds (prompt_id: ${promptId}). The workflow may still be running on ComfyUI server.`);
}

/**
 * Main function: Handle tool invocation
 * @param query - User query text
 * @param options - Optional configuration parameters
 * @param options.comfyUiUrl - ComfyUI server URL
 * @param options.workflowConfig - Workflow configuration options
 */
export async function handleToolInput(query: string, options: ToolInputOptions = {}): Promise<ToolResult> {
  try {
    const { comfyUiUrl, workflowConfig } = options;
    logger.info(`Received query: ${query}`);
    if (comfyUiUrl) {
      logger.info(`Using ComfyUI URL: ${comfyUiUrl}`);
    }

    // Parse input parameters
    const params = parseInput(query);
    logger.debug('Parsed parameters:', JSON.stringify(params, null, 2));

    // Get workflow template from configuration
    const workflowTemplate = getWorkflowTemplate(workflowConfig);

    // Update workflow
    const workflow = updateWorkflow(workflowTemplate, params);

    // Execute workflow
    const result = await executeComfyUIWorkflow(workflow, comfyUiUrl);

    logger.info(`Generated ${result.images.length} image(s)`);

    // Return result
    return {
      success: true,
      message: `Successfully generated ${result.images.length} image(s) with prompt: "${params.prompt}"`,
      data: {
        prompt: params.prompt,
        images: result.images.map(img => img.url),
        parameters: params
      }
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error:', errorMessage);

    return {
      success: false,
      error: errorMessage,
      message: `Failed to generate image: ${errorMessage}`
    };
  }
}

// ==================== n8n Integration ====================
// In n8n Custom Code Tool, use the following code:

// for (const item of items) {
//   const query = item.json.query || item.json.text || '';
//   const comfyUiUrl = item.json.comfyUiUrl || 'http://127.0.0.1:8188';
//   const result = await handleToolInput(query, { comfyUiUrl });
//   return result;
// }

// Export functions for testing
export {
  parseInput,
  updateWorkflow,
  findNodeByClassType,
  extractImagesFromOutputs,
  processImage
};
