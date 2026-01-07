/**
 * ComfyUI Workflow Parser
 * Parses API-format ComfyUI workflows and extracts configurable input parameters
 */

import { validateComfyUIWorkflow } from './validation';

type NodePropertyType = 'string' | 'number' | 'boolean' | 'options' | 'any';

export interface WorkflowNode {
  inputs?: Record<string, any>;
  class_type: string;
  _meta?: Record<string, any>;
}

export interface ComfyUIWorkflow {
  [nodeId: string]: WorkflowNode;
}

export interface ParsedWorkflowInput {
  nodeId: string;
  nodeTitle: string;
  classType: string;
  parameterName: string;
  parameterType: NodePropertyType;
  defaultValue?: any;
  required: boolean;
  description?: string;
  options?: Array<{ name: string; value: any }>;
  isImage?: boolean;
  isText?: boolean;
  isNumber?: boolean;
  isSeed?: boolean;
}

export interface ParsedWorkflowResult {
  valid: boolean;
  error?: string;
  inputs: ParsedWorkflowInput[];
  workflow: ComfyUIWorkflow;
}

/**
 * Node type configuration mapping
 * Defines how to handle different types of ComfyUI nodes
 */
const NODE_TYPE_CONFIGS: Record<string, any> = {
  LoadImage: {
    title: 'Image Input',
    inputs: {
      image: {
        type: 'string' as NodePropertyType,
        required: true,
        isImage: true,
        description: 'Input image URL or base64 data',
      },
    },
  },

  KSampler: {
    title: 'Sampler Parameters',
    inputs: {
      seed: {
        type: 'number' as NodePropertyType,
        required: false,
        isSeed: true,
        isNumber: true,
        description: 'Random seed (leave empty for auto-generate)',
      },
      steps: {
        type: 'number' as NodePropertyType,
        required: false,
        isNumber: true,
        description: 'Sampling steps',
      },
      cfg: {
        type: 'number' as NodePropertyType,
        required: false,
        isNumber: true,
        description: 'CFG strength',
      },
      sampler_name: {
        type: 'options' as NodePropertyType,
        required: false,
        options: [
          { name: 'Euler', value: 'euler' },
          { name: 'Euler_ancestral', value: 'euler_ancestral' },
          { name: 'Heun', value: 'heun' },
          { name: 'Dpm_2', value: 'dpm_2' },
          { name: 'Dpm_2_ancestral', value: 'dpm_2_ancestral' },
          { name: 'Lms', value: 'lms' },
          { name: 'Ddim', value: 'ddim' },
          { name: 'Uni_pc', value: 'uni_pc' },
        ],
        description: 'Sampler type',
      },
      scheduler: {
        type: 'options' as NodePropertyType,
        required: false,
        options: [
          { name: 'Normal', value: 'normal' },
          { name: 'Karras', value: 'karras' },
          { name: 'Exponential', value: 'exponential' },
          { name: 'Sgm_uniform', value: 'sgm_uniform' },
          { name: 'Simple', value: 'simple' },
          { name: 'Ddim_uniform', value: 'ddim_uniform' },
        ],
        description: 'Scheduler type',
      },
      denoise: {
        type: 'number' as NodePropertyType,
        required: false,
        isNumber: true,
        description: 'Denoise strength (0-1)',
      },
    },
  },

  CheckpointLoaderSimple: {
    title: 'Model Loader',
    inputs: {
      ckpt_name: {
        type: 'string' as NodePropertyType,
        required: false,
        description: 'Model filename (e.g., v1-5-pruned-emaonly.ckpt)',
      },
    },
  },

  LoraLoader: {
    title: 'LoRA Loader',
    inputs: {
      lora_name: {
        type: 'string' as NodePropertyType,
        required: false,
        description: 'LoRA model filename',
      },
      strength_model: {
        type: 'number' as NodePropertyType,
        required: false,
        isNumber: true,
        description: 'LoRA strength (model)',
      },
      strength_clip: {
        type: 'number' as NodePropertyType,
        required: false,
        isNumber: true,
        description: 'LoRA strength (CLIP)',
      },
    },
  },

  CLIPTextEncode: {
    title: 'Text Encoding',
    inputs: {
      text: {
        type: 'string' as NodePropertyType,
        required: true,
        isText: true,
        description: 'Text prompt',
      },
    },
  },

  EmptyLatentImage: {
    title: 'Latent Image Size',
    inputs: {
      width: {
        type: 'number' as NodePropertyType,
        required: false,
        isNumber: true,
        description: 'Image width',
      },
      height: {
        type: 'number' as NodePropertyType,
        required: false,
        isNumber: true,
        description: 'Image height',
      },
      batch_size: {
        type: 'number' as NodePropertyType,
        required: false,
        isNumber: true,
        description: 'Batch size',
      },
    },
  },

  VAEEncode: {
    title: 'VAE Encode',
    inputs: {},
  },

  VAEDecode: {
    title: 'VAE Decode',
    inputs: {},
  },

  SaveImage: {
    title: 'Save Image',
    inputs: {
      filename_prefix: {
        type: 'string' as NodePropertyType,
        required: false,
        description: 'Output filename prefix',
      },
    },
  },
};

/**
 * Parse ComfyUI workflow and extract all configurable input parameters
 */
export function parseWorkflowInputs(workflowJson: string): ParsedWorkflowResult {
  // First validate the workflow
  const validation = validateComfyUIWorkflow(workflowJson);
  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
      inputs: [],
      workflow: {},
    };
  }

  try {
    const workflow: ComfyUIWorkflow = JSON.parse(workflowJson);
    const inputs: ParsedWorkflowInput[] = [];

    // Iterate through all nodes
    for (const [nodeId, node] of Object.entries(workflow)) {
      const classType = node.class_type;
      const nodeConfig = NODE_TYPE_CONFIGS[classType];

      // If this node type has a configuration definition
      if (nodeConfig) {
        const nodeInputs = nodeConfig.inputs;

        // Iterate through node input parameters
        for (const [paramName, paramConfig] of Object.entries(nodeInputs)) {
          const config = paramConfig as any;

          // Check if this parameter is defined in the workflow
          const hasInputValue =
            node.inputs &&
            paramName in node.inputs &&
            !Array.isArray(node.inputs[paramName]); // Exclude node connections [nodeId, slotIndex]

          inputs.push({
            nodeId,
            nodeTitle: `${nodeConfig.title} (${nodeId})`,
            classType,
            parameterName: paramName,
            parameterType: config.type,
            defaultValue: hasInputValue ? node.inputs![paramName] : config.defaultValue,
            required: config.required ?? false,
            description: config.description,
            options: config.options,
            isImage: config.isImage ?? false,
            isText: config.isText ?? false,
            isNumber: config.isNumber ?? false,
            isSeed: config.isSeed ?? false,
          });
        }
      }
    }

    return {
      valid: true,
      inputs,
      workflow,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Failed to parse workflow: ${error.message}`,
      inputs: [],
      workflow: {},
    };
  }
}

/**
 * Update workflow with user input values
 */
export function updateWorkflowWithInputs(
  workflow: ComfyUIWorkflow,
  inputValues: Record<string, unknown>,
): ComfyUIWorkflow {
  const updatedWorkflow = JSON.parse(JSON.stringify(workflow)); // Deep copy

  // inputValues format: "nodeId_parameterName" -> value
  for (const [key, value] of Object.entries(inputValues)) {
    const [nodeId, paramName] = key.split('_');
    const node = updatedWorkflow[nodeId];

    if (node && node.inputs !== undefined) {
      // Update if value is not empty
      if (value !== null && value !== undefined && value !== '') {
        node.inputs[paramName] = value;
      }
    }
  }

  return updatedWorkflow;
}

/**
 * Generate node-friendly parameter name
 */
export function generateParameterKey(nodeId: string, paramName: string): string {
  return `${nodeId}_${paramName}`;
}
