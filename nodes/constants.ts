/**
 * Configuration constants for ComfyUI nodes
 */

// Default model configuration
export const DEFAULT_MODEL = 'v1-5-pruned-emaonly.ckpt';

// Image generation defaults
export const DEFAULT_IMAGE_WIDTH = 512;
export const DEFAULT_IMAGE_HEIGHT = 512;
export const DEFAULT_BATCH_SIZE = 1;
export const DEFAULT_DENOISE = 0.75;
export const DEFAULT_IMAGE_EDIT_DENOISE = 0.5;

// Sampling parameters
export const DEFAULT_STEPS = 20;
export const DEFAULT_CFG = 8;
export const DEFAULT_SAMPLER_NAME = 'euler';
export const DEFAULT_SCHEDULER = 'normal';

// Video generation defaults
export const DEFAULT_FRAMES = 16;

// Node IDs used in workflows
export const NodeIds = {
  K_SAMPLER: '3',
  CHECKPOINT_LOADER: '4',
  LATENT_IMAGE: '5',
  POSITIVE_CLIP: '6',
  NEGATIVE_CLIP: '7',
  VAE_DECODE: '8',
  SAVE_IMAGE: '9',
  LOAD_IMAGE: '10',
} as const;

// Validation limits
export const VALIDATION = {
  MAX_PROMPT_LENGTH: 10000,
  MAX_IMAGE_SIZE_MB: 50,
  MAX_SEED: 2147483647,
  MIN_FRAMES: 1,
  MAX_FRAMES: 128,
  MIN_DENOISE: 0,
  MAX_DENOISE: 1,
  MAX_WAIT_TIME_MS: 300000,
  REQUEST_TIMEOUT_MS: 300000,
  POLL_INTERVAL_MS: 1000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

// Private IP ranges for SSRF protection
export const PRIVATE_IP_PATTERNS = [
  /^127\./,                           // 127.0.0.0/8 (loopback)
  /^10\./,                            // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[0-1])\./,     // 172.16.0.0/12
  /^192\.168\./,                      // 192.168.0.0/16
  /^localhost$/i,                     // localhost
  /^::1$/,                            // IPv6 loopback
  /^fc00:/i,                          // IPv6 private fc00::/7
  /^fe80:/i,                          // IPv6 link-local fe80::/10
];

// Output formats
export const OUTPUT_FORMATS = {
  URL: 'url',
  BASE64: 'base64',
} as const;

// File prefixes
export const FILE_PREFIXES = {
  DEFAULT: 'ComfyUI',
} as const;

// MIME type mappings
export const IMAGE_MIME_TYPES: Record<string, string> = {
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'webp': 'image/webp',
  'gif': 'image/gif',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
} as const;

export const VIDEO_MIME_TYPES: Record<string, string> = {
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'mkv': 'video/x-matroska',
  'gif': 'video/gif',
} as const;
