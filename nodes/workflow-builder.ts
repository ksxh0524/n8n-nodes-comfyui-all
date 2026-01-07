import { randomInt } from 'crypto';
import {
  ComfyUIWorkflow,
  WorkflowOptions,
  WorkflowNode,
} from './types';
import {
  NodeIds,
  DEFAULT_MODEL,
  DEFAULT_STEPS,
  DEFAULT_CFG,
  DEFAULT_SAMPLER_NAME,
  DEFAULT_SCHEDULER,
  DEFAULT_DENOISE,
  DEFAULT_IMAGE_EDIT_DENOISE,
  DEFAULT_IMAGE_WIDTH,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_BATCH_SIZE,
  DEFAULT_FRAMES,
  VALIDATION,
} from './constants';

/**
 * Generate a random seed for ComfyUI generation
 */
function generateSeed(): number {
  return randomInt(0, VALIDATION.MAX_SEED);
}

/**
 * Create a checkpoint loader node
 */
function createCheckpointLoader(modelName?: string): WorkflowNode {
  return {
    inputs: {
      ckpt_name: modelName || DEFAULT_MODEL,
    },
    class_type: 'CheckpointLoaderSimple',
  };
}

/**
 * Create a KSampler node
 */
function createKSampler(
  seed: number,
  denoise: number,
  options?: WorkflowOptions,
): WorkflowNode {
  return {
    inputs: {
      seed,
      steps: options?.steps || DEFAULT_STEPS,
      cfg: options?.cfg || DEFAULT_CFG,
      sampler_name: options?.samplerName || DEFAULT_SAMPLER_NAME,
      scheduler: options?.scheduler || DEFAULT_SCHEDULER,
      denoise,
      model: [NodeIds.CHECKPOINT_LOADER, 0],
      positive: [NodeIds.POSITIVE_CLIP, 0],
      negative: [NodeIds.NEGATIVE_CLIP, 0],
      latent_image: [NodeIds.LATENT_IMAGE, 0],
    },
    class_type: 'KSampler',
  };
}

/**
 * Create an empty latent image node
 */
function createEmptyLatentImage(options?: WorkflowOptions): WorkflowNode {
  return {
    inputs: {
      width: options?.width || DEFAULT_IMAGE_WIDTH,
      height: options?.height || DEFAULT_IMAGE_HEIGHT,
      batch_size: DEFAULT_BATCH_SIZE,
    },
    class_type: 'EmptyLatentImage',
  };
}

/**
 * Create a latent image node for video with custom batch size
 */
function createVideoLatentImage(frames: number, options?: WorkflowOptions): WorkflowNode {
  return {
    inputs: {
      width: options?.width || DEFAULT_IMAGE_WIDTH,
      height: options?.height || DEFAULT_IMAGE_HEIGHT,
      batch_size: frames,
    },
    class_type: 'EmptyLatentImage',
  };
}

/**
 * Create a VAE encode node
 */
function createVAEEncode(): WorkflowNode {
  return {
    inputs: {
      pixels: [NodeIds.LOAD_IMAGE, 0],
      vae: [NodeIds.CHECKPOINT_LOADER, 2],
    },
    class_type: 'VAEEncode',
  };
}

/**
 * Create a CLIP text encode node for positive prompt
 */
function createPositiveClipEncode(prompt: string): WorkflowNode {
  return {
    inputs: {
      text: prompt,
      clip: [NodeIds.CHECKPOINT_LOADER, 1],
    },
    class_type: 'CLIPTextEncode',
  };
}

/**
 * Create a CLIP text encode node for negative prompt
 */
function createNegativeClipEncode(negativePrompt?: string): WorkflowNode {
  return {
    inputs: {
      text: negativePrompt || '',
      clip: [NodeIds.CHECKPOINT_LOADER, 1],
    },
    class_type: 'CLIPTextEncode',
  };
}

/**
 * Create a VAE decode node
 */
function createVAEDecode(): WorkflowNode {
  return {
    inputs: {
      samples: [NodeIds.K_SAMPLER, 0],
      vae: [NodeIds.CHECKPOINT_LOADER, 2],
    },
    class_type: 'VAEDecode',
  };
}

/**
 * Create a save image node
 */
function createSaveImage(): WorkflowNode {
  return {
    inputs: {
      filename_prefix: 'ComfyUI',
      images: [NodeIds.VAE_DECODE, 0],
    },
    class_type: 'SaveImage',
  };
}

/**
 * Create a load image node
 */
function createLoadImage(image: string): WorkflowNode {
  return {
    inputs: {
      image: image,
      'choose file to upload': 'image',
    },
    class_type: 'LoadImage',
  };
}

/**
 * Build a text-to-image workflow
 */
export function buildTextToImageWorkflow(
  prompt: string,
  negativePrompt: string | undefined,
  options?: WorkflowOptions,
): ComfyUIWorkflow {
  const seed = generateSeed();

  return {
    prompt: {
      [NodeIds.K_SAMPLER]: createKSampler(seed, 1, options),
      [NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
      [NodeIds.LATENT_IMAGE]: createEmptyLatentImage(options),
      [NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
      [NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
      [NodeIds.VAE_DECODE]: createVAEDecode(),
      [NodeIds.SAVE_IMAGE]: createSaveImage(),
    },
    extra_data: {},
  };
}

/**
 * Build an image-to-image workflow
 */
export function buildImageToImageWorkflow(
  prompt: string,
  negativePrompt: string | undefined,
  image: string,
  options?: WorkflowOptions,
): ComfyUIWorkflow {
  const seed = generateSeed();

  return {
    prompt: {
      [NodeIds.K_SAMPLER]: createKSampler(seed, DEFAULT_DENOISE, options),
      [NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
      [NodeIds.LATENT_IMAGE]: createVAEEncode(),
      [NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
      [NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
      [NodeIds.VAE_DECODE]: createVAEDecode(),
      [NodeIds.SAVE_IMAGE]: createSaveImage(),
      [NodeIds.LOAD_IMAGE]: createLoadImage(image),
    },
    extra_data: {},
  };
}

/**
 * Build an image edit workflow
 */
export function buildImageEditWorkflow(
  prompt: string,
  negativePrompt: string | undefined,
  image: string,
  options?: WorkflowOptions,
): ComfyUIWorkflow {
  const seed = generateSeed();
  const denoise = options?.denoise !== undefined ? options.denoise : DEFAULT_IMAGE_EDIT_DENOISE;

  return {
    prompt: {
      [NodeIds.K_SAMPLER]: createKSampler(seed, denoise, options),
      [NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
      [NodeIds.LATENT_IMAGE]: createVAEEncode(),
      [NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
      [NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
      [NodeIds.VAE_DECODE]: createVAEDecode(),
      [NodeIds.SAVE_IMAGE]: createSaveImage(),
      [NodeIds.LOAD_IMAGE]: createLoadImage(image),
    },
    extra_data: {},
  };
}

/**
 * Build a text-to-video workflow
 */
export function buildTextToVideoWorkflow(
  prompt: string,
  negativePrompt: string | undefined,
  options?: WorkflowOptions,
): ComfyUIWorkflow {
  const seed = generateSeed();
  const frames = options?.frames || DEFAULT_FRAMES;

  return {
    prompt: {
      [NodeIds.K_SAMPLER]: createKSampler(seed, 1, options),
      [NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
      [NodeIds.LATENT_IMAGE]: createVideoLatentImage(frames, options),
      [NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
      [NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
      [NodeIds.VAE_DECODE]: createVAEDecode(),
      [NodeIds.SAVE_IMAGE]: createSaveImage(),
    },
    extra_data: {},
  };
}

/**
 * Build an image-to-video workflow
 */
export function buildImageToVideoWorkflow(
  prompt: string,
  negativePrompt: string | undefined,
  image: string,
  options?: WorkflowOptions,
): ComfyUIWorkflow {
  const seed = generateSeed();

  return {
    prompt: {
      [NodeIds.K_SAMPLER]: createKSampler(seed, DEFAULT_DENOISE, options),
      [NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
      [NodeIds.LATENT_IMAGE]: createVAEEncode(),
      [NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
      [NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
      [NodeIds.VAE_DECODE]: createVAEDecode(),
      [NodeIds.SAVE_IMAGE]: createSaveImage(),
      [NodeIds.LOAD_IMAGE]: createLoadImage(image),
    },
    extra_data: {},
  };
}
