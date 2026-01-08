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
 * Default workflow template for image-to-image generation
 * This workflow takes an input image and generates a new image based on the prompt
 */
export const IMAGE_TO_IMAGE_WORKFLOW_TEMPLATE: Workflow = {
  "3": {
    "inputs": {
      "seed": 0,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 0.75,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["10", 0]
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
      "image": "input_image.png",
      "upload": "image"
    },
    "class_type": "LoadImage"
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
  "10": {
    "inputs": {
      "pixels": ["5", 0],
      "vae": ["4", 2]
    },
    "class_type": "VAEEncode"
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
export function getWorkflowTemplate(config?: WorkflowConfig & { mode?: 'text-to-image' | 'image-to-image' }): Workflow {
  // If custom template is provided, try to parse it
  if (config?.customTemplate) {
    try {
      return safeJsonParse(config.customTemplate, 'Custom workflow template') as Workflow;
    } catch (error: unknown) {
      // Silently fall back to default template on error
    }
  }

  // Check if template is a valid non-empty object
  if (config?.template && typeof config.template === 'object' && Object.keys(config.template).length > 0) {
    return config.template as Workflow;
  }

  // Return template based on mode
  if (config?.mode === 'image-to-image') {
    return IMAGE_TO_IMAGE_WORKFLOW_TEMPLATE;
  }

  return DEFAULT_WORKFLOW_TEMPLATE;
}