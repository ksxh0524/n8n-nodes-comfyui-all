/**
 * Utility functions for ComfyUI nodes
 */

import { randomUUID } from 'crypto';
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES, VALIDATION } from './constants';

export interface FileInfo {
  filename: string;
  extension: string;
  mimeType: string;
}

/**
 * Extract file information from a path
 * @param path - File path (can include query parameters)
 * @param defaultExt - Default extension if none found
 * @param mimeType - MIME type for fallback
 * @returns File information
 */
export function extractFileInfo(
  path: string,
  defaultExt: string,
  mimeType?: string
): FileInfo {
  let filename: string;

  // Try to extract filename from URL query parameters first (ComfyUI format)
  // ComfyUI URLs look like: /view?filename=image_12345.png&subfolder=&type=output
  if (path.includes('filename=')) {
    const filenameMatch = path.match(/filename=([^&]+)/);
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1]);
    } else {
      // Fallback: extract from path
      filename = path.split('/').pop() || `file_${randomUUID()}.${defaultExt}`;
    }
  } else {
    // No query parameters, extract from path
    filename = path.split('/').pop() || `file_${randomUUID()}.${defaultExt}`;
  }

  // Remove query parameters if still present
  if (filename.includes('?')) {
    filename = filename.split('?')[0];
  }

  // Extract extension
  let ext = defaultExt;
  const extMatch = filename.match(/\.([^.]+)$/);
  if (extMatch) {
    ext = extMatch[1].toLowerCase();
  }

  // If no extension in filename and type is specified in path
  if (!extMatch && path.includes('type=')) {
    const typeMatch = path.match(/type=([^&]+)/);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();
      const mimeMap: Record<string, string> = {
        'input': 'png',
        'output': 'png',
        'temp': 'png',
      };
      ext = mimeMap[type] || defaultExt;
    }
  }

  // Determine MIME type
  let finalMimeType = mimeType;
  if (!finalMimeType) {
    // Try to get MIME type from extension
    const imageMimeType = IMAGE_MIME_TYPES[ext];
    const videoMimeType = VIDEO_MIME_TYPES[ext];
    finalMimeType = imageMimeType || videoMimeType || 'application/octet-stream';
  }

  // If filename doesn't have extension, add it
  if (!extMatch && ext !== defaultExt) {
    filename = `${filename}.${ext}`;
  }

  return {
    filename,
    extension: ext,
    mimeType: finalMimeType,
  };
}

/**
 * Extract file information for images
 * @param path - File path
 * @param defaultExt - Default extension
 * @returns File information with image MIME type
 */
export function extractImageFileInfo(path: string, defaultExt: string = 'png'): FileInfo {
  const fileInfo = extractFileInfo(path, defaultExt);

  // Ensure the MIME type is an image type
  if (!Object.values(IMAGE_MIME_TYPES).includes(fileInfo.mimeType)) {
    // If the detected MIME type is not an image, use the default extension
    const defaultMime = IMAGE_MIME_TYPES[defaultExt];
    if (defaultMime) {
      fileInfo.mimeType = defaultMime;
    }
  }

  return fileInfo;
}

/**
 * Extract file information for videos
 * @param path - File path
 * @param defaultExt - Default extension
 * @returns File information with video MIME type
 */
export function extractVideoFileInfo(path: string, defaultExt: string = 'mp4'): FileInfo {
  const fileInfo = extractFileInfo(path, defaultExt);

  // Ensure the MIME type is a video type
  if (!Object.values(VIDEO_MIME_TYPES).includes(fileInfo.mimeType)) {
    // If the detected MIME type is not a video, use the default extension
    const defaultMime = VIDEO_MIME_TYPES[defaultExt];
    if (defaultMime) {
      fileInfo.mimeType = defaultMime;
    }
  }

  return fileInfo;
}

/**
 * Validate and sanitize filename
 * @param filename - The filename to validate
 * @returns Sanitized filename
 * @throws Error if filename is invalid
 */
export function validateFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Filename must be a non-empty string');
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Filename cannot contain path traversal characters (.., /, \\)');
  }

  // Limit filename length
  const MAX_FILENAME_LENGTH = 255;
  if (filename.length > MAX_FILENAME_LENGTH) {
    throw new Error(`Filename too long (maximum ${MAX_FILENAME_LENGTH} characters)`);
  }

  // Remove null bytes
  filename = filename.replace(/\0/g, '');

  if (filename.length === 0) {
    throw new Error('Filename cannot be empty after sanitization');
  }

  return filename;
}

/**
 * Generate a unique filename using UUID
 * @param extension - File extension (without dot)
 * @param prefix - Optional prefix for the filename
 * @returns Unique filename
 */
export function generateUniqueFilename(extension: string, prefix: string = 'file'): string {
  const uuid = randomUUID();
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  return `${prefix}_${uuid}.${ext}`;
}

/**
 * Validate buffer size before processing
 * @param buffer - The buffer to validate
 * @param maxSizeMB - Maximum size in megabytes
 * @param context - Context for error message
 * @throws Error if buffer exceeds maximum size
 */
export function validateBufferSize(
  buffer: Buffer,
  maxSizeMB: number = VALIDATION.MAX_IMAGE_SIZE_MB as number,
  context: string = 'Buffer'
): void {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error(`${context}: Invalid buffer type`);
  }

  if (buffer.length === 0) {
    throw new Error(`${context}: Buffer is empty`);
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (buffer.length > maxSizeBytes) {
    const sizeMB = Math.round(buffer.length / 1024 / 1024);
    throw new Error(`${context}: Size (${sizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB`);
  }
}

/**
 * Validate MIME type against allowed types
 * @param mimeType - MIME type to validate
 * @param allowedTypes - Record of allowed MIME types
 * @returns Validated MIME type
 * @throws Error if MIME type is invalid
 */
export function validateMimeType(
  mimeType: string,
  allowedTypes: Record<string, string>
): string {
  if (!mimeType || typeof mimeType !== 'string') {
    throw new Error('MIME type must be a non-empty string');
  }

  const normalized = mimeType.toLowerCase();
  const allowedValues = Object.values(allowedTypes);

  if (!allowedValues.includes(normalized)) {
    throw new Error(
      `Unsupported MIME type "${normalized}". Allowed types: ${allowedValues.join(', ')}`
    );
  }

  return normalized;
}

/**
 * Get maximum image size in bytes
 * @returns Maximum size in bytes (from VALIDATION.MAX_IMAGE_SIZE_MB)
 */
export function getMaxImageSizeBytes(): number {
  return (VALIDATION.MAX_IMAGE_SIZE_MB as number) * 1024 * 1024;
}

/**
 * Get maximum video size in bytes
 * @returns Maximum size in bytes (from VALIDATION.MAX_VIDEO_SIZE_MB)
 */
export function getMaxVideoSizeBytes(): number {
  return (VALIDATION.MAX_VIDEO_SIZE_MB as number) * 1024 * 1024;
}

/**
 * Get maximum Base64 encoded length for an image
 * Base64 encoding increases size by approximately 33% (4/3 ratio)
 * @returns Maximum Base64 length in bytes
 */
export function getMaxBase64Length(): number {
  return getMaxImageSizeBytes() * 4 / 3;
}

/**
 * Format bytes to human-readable size
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
