import { Workflow } from './types';

/**
 * Default workflow template for text-to-image generation
 * This is a basic Stable Diffusion workflow that can be customized
 */
export const DEFAULT_WORKFLOW_TEMPLATE: Workflow = {
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
 * Workflow configuration options
 */
export interface WorkflowConfig {
  template?: Workflow;
  customTemplate?: string;
}

/**
 * Get workflow template based on configuration
 * @param config - Workflow configuration
 * @returns Workflow template
 */
export function getWorkflowTemplate(config?: WorkflowConfig): Workflow {
  if (config?.customTemplate) {
    try {
      return JSON.parse(config.customTemplate) as Workflow;
    } catch (error) {
      console.warn('Failed to parse custom workflow template, using default');
    }
  }

  return config?.template || DEFAULT_WORKFLOW_TEMPLATE;
}