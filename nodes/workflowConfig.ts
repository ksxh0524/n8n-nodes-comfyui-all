import { Workflow, WorkflowConfig } from './types';
import { safeJsonParse } from './validation';

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
 * Get workflow template based on configuration
 * @param config - Workflow configuration
 * @returns Workflow template
 */
export function getWorkflowTemplate(config?: WorkflowConfig): Workflow {
  if (config?.customTemplate) {
    try {
      return safeJsonParse(config.customTemplate, 'Custom workflow template');
    } catch (error: unknown) {
      // Log warning when custom template fails
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`Custom workflow template is invalid, falling back to default template. Error: ${errorMsg}`);
    }
  }

  // Check if template is a valid non-empty object
  if (config?.template && typeof config.template === 'object' && Object.keys(config.template).length > 0) {
    return config.template;
  }

  return DEFAULT_WORKFLOW_TEMPLATE;
}