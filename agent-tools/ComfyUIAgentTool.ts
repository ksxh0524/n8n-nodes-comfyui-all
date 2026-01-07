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

// Type definitions
interface WorkflowNode {
  inputs: Record<string, any>;
  class_type: string;
}

interface PromptResponse {
  prompt_id: string;
}

interface HistoryResponse {
  [key: string]: {
    outputs?: any;
    status?: {
      completed: boolean;
    };
  };
}

interface Workflow {
  [nodeId: string]: WorkflowNode;
}

interface ImageInfo {
  filename: string;
  subfolder: string;
  type: string;
  url: string;
}

interface ParsedParameters {
  prompt: string;
  negative_prompt: string;
  width: number;
  height: number;
  steps: number;
  cfg: number;
  seed: number;
}

interface ParameterPattern {
  regex: RegExp;
  paramKey?: string;
  paramKeys?: string[];
  parser: (match: RegExpMatchArray) => any;
}

interface ToolInputOptions {
  comfyUiUrl?: string;
}

interface ToolResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    prompt: string;
    images: string[];
    parameters: ParsedParameters;
  };
}

interface ParameterExtractionResult {
  value: any;
  cleanedQuery: string;
}

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

// Example workflow template (text to image generation)
// You can export your own workflow from ComfyUI and replace this template
const WORKFLOW_TEMPLATE: Workflow = {
  "3": {
    "inputs": {
      "seed": 0,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler"
  },
  "4": {
    "inputs": {
      "ckpt_name": "v1-5-pruned-emaonly.ckpt"
    },
    "class_type": "CheckpointLoaderSimple"
  },
  "5": {
    "inputs": {
      "width": 512,
      "height": 512,
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage"
  },
  "6": {
    "inputs": {
      "text": "",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": {
      "text": "ugly, blurry, low quality",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": {
      "samples": ["3", 0],
      "vae": ["4", 2]
    },
    "class_type": "VAEDecode"
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": ["8", 0]
    },
    "class_type": "SaveImage"
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
    seed: Math.floor(Math.random() * MAX_SEED_VALUE)
  };

  let currentQuery = query.trim();

  for (const [, pattern] of Object.entries(PARAM_PATTERNS)) {
    const { value, cleanedQuery } = extractParameter(currentQuery, pattern);

    if (value !== null) {
      if (pattern.paramKeys) {
        pattern.paramKeys.forEach((key, index) => {
          (params as any)[key] = value[Object.keys(value)[index]];
        });
      } else if (pattern.paramKey) {
        (params as any)[pattern.paramKey] = value;
      }
      currentQuery = cleanedQuery;
    }
  }

  // Clean up remaining parameter markers and extra punctuation
  currentQuery = currentQuery
    .replace(/，\s*，/g, '，') // Remove consecutive Chinese commas
    .replace(/,\s*,/g, ',') // Remove consecutive English commas
    .replace(/[，,]\s*$/g, '') // Remove trailing Chinese or English comma
    .replace(/^\s*[，,]\s*/g, '') // Remove leading Chinese or English comma
    .replace(/[，,]\s*[，,]/g, ' ') // Remove extra spaces between commas
    .replace(/[，,]\s*$/g, '') // Remove trailing comma again
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
function extractImagesFromOutputs(outputs: any, url: string): ImageInfo[] {
  const images: ImageInfo[] = [];

  for (const nodeId in outputs) {
    if (!outputs[nodeId] || !outputs[nodeId].images) {
      continue;
    }

    const nodeImages = outputs[nodeId].images;

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
function processImage(image: any, nodeId: string, url: string): ImageInfo | null {
  if (!image || typeof image !== 'object') {
    console.warn(`[ComfyUI Tool] Invalid image object in node ${nodeId}`);
    return null;
  }

  const filename = image.filename;
  const subfolder = image.subfolder || '';
  const type = image.type || 'output';

  if (!filename) {
    console.warn(`[ComfyUI Tool] Image missing filename in node ${nodeId}`);
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
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Failed to connect to ComfyUI server at ${url}. Please check if the server is running.`);
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`Connection timeout while connecting to ComfyUI server at ${url}.`);
    } else if (error.response) {
      throw new Error(`ComfyUI server returned error: ${error.response.status} ${error.response.statusText}`);
    } else {
      throw new Error(`Failed to queue workflow: ${error.message}`);
    }
  }

  if (!promptResponse.data || !promptResponse.data.prompt_id) {
    throw new Error('Invalid response from ComfyUI server: missing prompt_id');
  }

  const promptId = promptResponse.data.prompt_id;
  console.log(`[ComfyUI Tool] Workflow queued with ID: ${promptId}`);

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
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Lost connection to ComfyUI server at ${url}.`);
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.warn(`[ComfyUI Tool] Timeout checking history (attempt ${attempts + 1}/${POLLING_MAX_ATTEMPTS})`);
        attempts++;
        continue;
      } else {
        console.warn(`[ComfyUI Tool] Error checking history: ${error.message}`);
        attempts++;
        continue;
      }
    }

    if (historyResponse.data && historyResponse.data[promptId]) {
      const outputs = historyResponse.data[promptId].outputs;

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
 */
export async function handleToolInput(query: string, options: ToolInputOptions = {}): Promise<ToolResult> {
  try {
    const { comfyUiUrl } = options;
    console.log(`[ComfyUI Tool] Received query: ${query}`);
    if (comfyUiUrl) {
      console.log(`[ComfyUI Tool] Using ComfyUI URL: ${comfyUiUrl}`);
    }

    // Parse input parameters
    const params = parseInput(query);
    console.log('[ComfyUI Tool] Parsed parameters:', JSON.stringify(params, null, 2));

    // Update workflow
    const workflow = updateWorkflow(WORKFLOW_TEMPLATE, params);

    // Execute workflow
    const result = await executeComfyUIWorkflow(workflow, comfyUiUrl);

    console.log(`[ComfyUI Tool] Generated ${result.images.length} image(s)`);

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

  } catch (error: any) {
    console.error('[ComfyUI Tool] Error:', error.message);

    return {
      success: false,
      error: error.message,
      message: `Failed to generate image: ${error.message}`
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
