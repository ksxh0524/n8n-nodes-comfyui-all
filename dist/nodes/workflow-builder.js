"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTextToImageWorkflow = buildTextToImageWorkflow;
exports.buildImageToImageWorkflow = buildImageToImageWorkflow;
exports.buildImageEditWorkflow = buildImageEditWorkflow;
exports.buildTextToVideoWorkflow = buildTextToVideoWorkflow;
exports.buildImageToVideoWorkflow = buildImageToVideoWorkflow;
const crypto_1 = require("crypto");
const constants_1 = require("./constants");
/**
 * Generate a random seed for ComfyUI generation
 */
function generateSeed() {
    return (0, crypto_1.randomInt)(0, constants_1.VALIDATION.MAX_SEED);
}
/**
 * Create a checkpoint loader node
 */
function createCheckpointLoader(modelName) {
    return {
        inputs: {
            ckpt_name: modelName || constants_1.DEFAULT_MODEL,
        },
        class_type: 'CheckpointLoaderSimple',
    };
}
/**
 * Create a KSampler node
 */
function createKSampler(seed, denoise, options) {
    return {
        inputs: {
            seed,
            steps: options?.steps || constants_1.DEFAULT_STEPS,
            cfg: options?.cfg || constants_1.DEFAULT_CFG,
            sampler_name: options?.samplerName || constants_1.DEFAULT_SAMPLER_NAME,
            scheduler: options?.scheduler || constants_1.DEFAULT_SCHEDULER,
            denoise,
            model: [constants_1.NodeIds.CHECKPOINT_LOADER, 0],
            positive: [constants_1.NodeIds.POSITIVE_CLIP, 0],
            negative: [constants_1.NodeIds.NEGATIVE_CLIP, 0],
            latent_image: [constants_1.NodeIds.LATENT_IMAGE, 0],
        },
        class_type: 'KSampler',
    };
}
/**
 * Create an empty latent image node
 */
function createEmptyLatentImage(options) {
    return {
        inputs: {
            width: options?.width || constants_1.DEFAULT_IMAGE_WIDTH,
            height: options?.height || constants_1.DEFAULT_IMAGE_HEIGHT,
            batch_size: constants_1.DEFAULT_BATCH_SIZE,
        },
        class_type: 'EmptyLatentImage',
    };
}
/**
 * Create a latent image node for video with custom batch size
 */
function createVideoLatentImage(frames, options) {
    return {
        inputs: {
            width: options?.width || constants_1.DEFAULT_IMAGE_WIDTH,
            height: options?.height || constants_1.DEFAULT_IMAGE_HEIGHT,
            batch_size: frames,
        },
        class_type: 'EmptyLatentImage',
    };
}
/**
 * Create a VAE encode node
 */
function createVAEEncode() {
    return {
        inputs: {
            pixels: [constants_1.NodeIds.LOAD_IMAGE, 0],
            vae: [constants_1.NodeIds.CHECKPOINT_LOADER, 2],
        },
        class_type: 'VAEEncode',
    };
}
/**
 * Create a CLIP text encode node for positive prompt
 */
function createPositiveClipEncode(prompt) {
    return {
        inputs: {
            text: prompt,
            clip: [constants_1.NodeIds.CHECKPOINT_LOADER, 1],
        },
        class_type: 'CLIPTextEncode',
    };
}
/**
 * Create a CLIP text encode node for negative prompt
 */
function createNegativeClipEncode(negativePrompt) {
    return {
        inputs: {
            text: negativePrompt || '',
            clip: [constants_1.NodeIds.CHECKPOINT_LOADER, 1],
        },
        class_type: 'CLIPTextEncode',
    };
}
/**
 * Create a VAE decode node
 */
function createVAEDecode() {
    return {
        inputs: {
            samples: [constants_1.NodeIds.K_SAMPLER, 0],
            vae: [constants_1.NodeIds.CHECKPOINT_LOADER, 2],
        },
        class_type: 'VAEDecode',
    };
}
/**
 * Create a save image node
 */
function createSaveImage() {
    return {
        inputs: {
            filename_prefix: 'ComfyUI',
            images: [constants_1.NodeIds.VAE_DECODE, 0],
        },
        class_type: 'SaveImage',
    };
}
/**
 * Create a load image node
 */
function createLoadImage(image) {
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
function buildTextToImageWorkflow(prompt, negativePrompt, options) {
    const seed = generateSeed();
    return {
        prompt: {
            [constants_1.NodeIds.K_SAMPLER]: createKSampler(seed, 1, options),
            [constants_1.NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
            [constants_1.NodeIds.LATENT_IMAGE]: createEmptyLatentImage(options),
            [constants_1.NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
            [constants_1.NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
            [constants_1.NodeIds.VAE_DECODE]: createVAEDecode(),
            [constants_1.NodeIds.SAVE_IMAGE]: createSaveImage(),
        },
        extra_data: {},
    };
}
/**
 * Build an image-to-image workflow
 */
function buildImageToImageWorkflow(prompt, negativePrompt, image, options) {
    const seed = generateSeed();
    return {
        prompt: {
            [constants_1.NodeIds.K_SAMPLER]: createKSampler(seed, constants_1.DEFAULT_DENOISE, options),
            [constants_1.NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
            [constants_1.NodeIds.LATENT_IMAGE]: createVAEEncode(),
            [constants_1.NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
            [constants_1.NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
            [constants_1.NodeIds.VAE_DECODE]: createVAEDecode(),
            [constants_1.NodeIds.SAVE_IMAGE]: createSaveImage(),
            [constants_1.NodeIds.LOAD_IMAGE]: createLoadImage(image),
        },
        extra_data: {},
    };
}
/**
 * Build an image edit workflow
 */
function buildImageEditWorkflow(prompt, negativePrompt, image, options) {
    const seed = generateSeed();
    const denoise = options?.denoise !== undefined ? options.denoise : constants_1.DEFAULT_IMAGE_EDIT_DENOISE;
    return {
        prompt: {
            [constants_1.NodeIds.K_SAMPLER]: createKSampler(seed, denoise, options),
            [constants_1.NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
            [constants_1.NodeIds.LATENT_IMAGE]: createVAEEncode(),
            [constants_1.NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
            [constants_1.NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
            [constants_1.NodeIds.VAE_DECODE]: createVAEDecode(),
            [constants_1.NodeIds.SAVE_IMAGE]: createSaveImage(),
            [constants_1.NodeIds.LOAD_IMAGE]: createLoadImage(image),
        },
        extra_data: {},
    };
}
/**
 * Build a text-to-video workflow
 */
function buildTextToVideoWorkflow(prompt, negativePrompt, options) {
    const seed = generateSeed();
    const frames = options?.frames || constants_1.DEFAULT_FRAMES;
    return {
        prompt: {
            [constants_1.NodeIds.K_SAMPLER]: createKSampler(seed, 1, options),
            [constants_1.NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
            [constants_1.NodeIds.LATENT_IMAGE]: createVideoLatentImage(frames, options),
            [constants_1.NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
            [constants_1.NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
            [constants_1.NodeIds.VAE_DECODE]: createVAEDecode(),
            [constants_1.NodeIds.SAVE_IMAGE]: createSaveImage(),
        },
        extra_data: {},
    };
}
/**
 * Build an image-to-video workflow
 */
function buildImageToVideoWorkflow(prompt, negativePrompt, image, options) {
    const seed = generateSeed();
    return {
        prompt: {
            [constants_1.NodeIds.K_SAMPLER]: createKSampler(seed, constants_1.DEFAULT_DENOISE, options),
            [constants_1.NodeIds.CHECKPOINT_LOADER]: createCheckpointLoader(options?.modelName),
            [constants_1.NodeIds.LATENT_IMAGE]: createVAEEncode(),
            [constants_1.NodeIds.POSITIVE_CLIP]: createPositiveClipEncode(prompt),
            [constants_1.NodeIds.NEGATIVE_CLIP]: createNegativeClipEncode(negativePrompt),
            [constants_1.NodeIds.VAE_DECODE]: createVAEDecode(),
            [constants_1.NodeIds.SAVE_IMAGE]: createSaveImage(),
            [constants_1.NodeIds.LOAD_IMAGE]: createLoadImage(image),
        },
        extra_data: {},
    };
}
//# sourceMappingURL=workflow-builder.js.map