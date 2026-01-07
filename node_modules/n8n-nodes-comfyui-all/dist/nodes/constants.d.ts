/**
 * Configuration constants for ComfyUI nodes
 */
export declare const DEFAULT_MODEL = "v1-5-pruned-emaonly.ckpt";
export declare const DEFAULT_IMAGE_WIDTH = 512;
export declare const DEFAULT_IMAGE_HEIGHT = 512;
export declare const DEFAULT_BATCH_SIZE = 1;
export declare const DEFAULT_DENOISE = 0.75;
export declare const DEFAULT_IMAGE_EDIT_DENOISE = 0.5;
export declare const DEFAULT_STEPS = 20;
export declare const DEFAULT_CFG = 8;
export declare const DEFAULT_SAMPLER_NAME = "euler";
export declare const DEFAULT_SCHEDULER = "normal";
export declare const DEFAULT_FRAMES = 16;
export declare const NodeIds: {
    readonly K_SAMPLER: "3";
    readonly CHECKPOINT_LOADER: "4";
    readonly LATENT_IMAGE: "5";
    readonly POSITIVE_CLIP: "6";
    readonly NEGATIVE_CLIP: "7";
    readonly VAE_DECODE: "8";
    readonly SAVE_IMAGE: "9";
    readonly LOAD_IMAGE: "10";
};
export declare const VALIDATION: {
    readonly MAX_PROMPT_LENGTH: 10000;
    readonly MAX_IMAGE_SIZE_MB: 50;
    readonly MAX_SEED: 2147483647;
    readonly MIN_FRAMES: 1;
    readonly MAX_FRAMES: 128;
    readonly MIN_DENOISE: 0;
    readonly MAX_DENOISE: 1;
    readonly MAX_WAIT_TIME_MS: 300000;
    readonly REQUEST_TIMEOUT_MS: 300000;
    readonly POLL_INTERVAL_MS: 1000;
    readonly MAX_RETRIES: 3;
    readonly RETRY_DELAY_MS: 1000;
};
export declare const PRIVATE_IP_PATTERNS: RegExp[];
export declare const OUTPUT_FORMATS: {
    readonly URL: "url";
    readonly BASE64: "base64";
};
export declare const FILE_PREFIXES: {
    readonly DEFAULT: "ComfyUI";
};
export declare const IMAGE_MIME_TYPES: Record<string, string>;
export declare const VIDEO_MIME_TYPES: Record<string, string>;
//# sourceMappingURL=constants.d.ts.map