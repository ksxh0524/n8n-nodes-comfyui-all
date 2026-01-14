/**
 * Image Processor - Handles image and video parameter processing
 * Supports both URL download and binary data upload
 */

import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import type { BinaryData } from '../types';
import { Logger } from '../logger';
import { validateUrl } from '../validation';
import { generateUniqueFilename, getMaxVideoSizeBytes, getMaxImageSizeBytes, formatBytes, getMaxBase64Length } from '../utils';
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES, BASE64_DECODE_FACTOR } from '../constants';

export interface ImageProcessorConfig {
  executeFunctions: IExecuteFunctions;
  logger: Logger;
  isToolMode: boolean;
}

export interface ImageUploadResult {
  filename: string;
  size: number;
  mimeType?: string;
}

/**
 * Configuration object for processing image from URL
 */
export interface ProcessFromUrlConfig {
  paramName: string;
  imageUrl: string;
  index: number;
  uploadImage: (buffer: Buffer, filename: string) => Promise<string>;
  timeout: number;
}

/**
 * Configuration object for processing image from binary data
 */
export interface ProcessFromBinaryConfig {
  paramName: string;
  binaryPropertyName: string;
  index: number;
  uploadImage: (buffer: Buffer, filename: string) => Promise<string>;
}

/**
 * Handles image parameter processing for ComfyUI nodes
 */
export class ImageProcessor {
  private executeFunctions: IExecuteFunctions;
  private logger: Logger;
  private isToolMode: boolean;

  constructor(config: ImageProcessorConfig) {
    this.executeFunctions = config.executeFunctions;
    this.logger = config.logger;
    this.isToolMode = config.isToolMode ?? false;
  }

  /**
   * Process image or video from URL - download and upload to ComfyUI
   * Uses configuration object instead of multiple parameters
   */
  async processFromUrl(config: ProcessFromUrlConfig): Promise<ImageUploadResult> {
    const { paramName, imageUrl, index, uploadImage, timeout } = config;

    this.validateFileUrl(imageUrl, index);
    await this.validateFileUrlFormat(imageUrl, index);

    this.logger.info(`Downloading file from URL`, { url: imageUrl, paramName });

    const fileBuffer = await this.downloadFile(imageUrl, index, timeout);
    
    // Detect MIME type from URL extension for size validation
    const ext = this.getFileExtensionFromUrl(imageUrl);
    const mimeType = this.getMimeTypeFromExtension(ext);
    this.validateFileSize(fileBuffer, index, mimeType);

    const filename = generateUniqueFilename(ext || 'png', 'download');
    this.logger.info(`Uploading file to ComfyUI`, { filename, size: fileBuffer.length });

    const uploadedFilename = await uploadImage(fileBuffer, filename);

    this.logger.info(`Successfully uploaded file`, { paramName, filename: uploadedFilename });

    return { filename: uploadedFilename, size: fileBuffer.length };
  }

  /**
   * Process image or video from binary data - extract from input and upload to ComfyUI
   * Uses configuration object instead of multiple parameters
   */
  async processFromBinary(config: ProcessFromBinaryConfig): Promise<ImageUploadResult> {
    const { paramName, binaryPropertyName, index, uploadImage } = config;

    // Tool mode doesn't support binary input
    if (this.isToolMode) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Binary file input is not supported in Tool mode. Please use URL input instead.`
      );
    }

    this.logger.info(`Getting binary data from input`, {
      binaryProperty: binaryPropertyName || 'data',
      paramName
    });

    const { binaryData, availableKeys } = this.findBinaryData(binaryPropertyName || 'data', index);
    this.validateBinaryData(binaryData, binaryPropertyName || 'data', index, availableKeys);

    // After validation, binaryData is guaranteed to be non-null
    if (!binaryData) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Binary data validation failed.`
      );
    }

    this.logger.debug(`Found binary property "${binaryPropertyName || 'data'}" in input`);

    const buffer = this.decodeBinaryData(binaryData, index);
    this.validateDecodedBuffer(buffer, binaryPropertyName || 'data', index, binaryData.mimeType);

    const filename = binaryData.fileName || generateUniqueFilename(
      binaryData.mimeType?.split('/')[1] || 'png',
      'upload'
    );

    this.logger.info(`Uploading binary data to ComfyUI`, {
      filename,
      size: buffer.length,
      mimeType: binaryData.mimeType,
      paramName
    });

    const uploadedFilename = await uploadImage(buffer, filename);

    this.logger.info(`Successfully uploaded binary data`, { paramName, filename: uploadedFilename });

    return { filename: uploadedFilename, size: buffer.length, mimeType: binaryData.mimeType };
  }

  /**
   * Validate file URL is provided
   */
  private validateFileUrl(fileUrl: string, index: number): void {
    if (!fileUrl) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: File URL is required when File Input Type is set to URL.`
      );
    }
  }

  /**
   * Validate URL format (allows private network addresses for internal use)
   */
  private async validateFileUrlFormat(fileUrl: string, index: number): Promise<void> {
    try {
      if (!validateUrl(fileUrl)) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Invalid file URL "${fileUrl}". ` +
          `Must be a valid HTTP/HTTPS URL.`
        );
      }
    } catch (error) {
      // Handle validation errors
      if (error instanceof NodeOperationError) {
        throw error;
      }
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: URL validation failed - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Download file from URL
   */
  private async downloadFile(fileUrl: string, index: number, timeout: number): Promise<Buffer> {
    try {
      const fileResponse = await this.executeFunctions.helpers.httpRequest({
        method: 'GET',
        url: fileUrl,
        encoding: 'arraybuffer',
        timeout: timeout * 1000,
      });

      if (!fileResponse || !Buffer.isBuffer(fileResponse)) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Failed to download file from URL "${fileUrl}". The server did not return valid file data.`
        );
      }

      const fileBuffer = Buffer.from(fileResponse);

      if (fileBuffer.length === 0) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Downloaded file from URL "${fileUrl}" is empty.`
        );
      }

      this.logger.info(`Successfully downloaded file`, { size: fileBuffer.length, url: fileUrl });
      return fileBuffer;

    } catch (error: unknown) {
      if (error instanceof NodeOperationError) {
        throw error;
      }

      const httpError = error as { response?: { statusCode?: number; statusMessage?: string } };
      const statusCode = httpError.response?.statusCode;
      const statusMessage = httpError.response?.statusMessage;

      let errorMessage = `Node Parameters ${index + 1}: Failed to download file from URL "${fileUrl}"`;
      if (statusCode) {
        errorMessage += ` (HTTP ${statusCode} ${statusMessage || ''})`;
      }

      // Add helpful hints for common error codes
      if (statusCode === 403) {
        errorMessage += ' Note: The URL may require authentication or block automated access.';
      } else if (statusCode === 404) {
        errorMessage += ' Note: The URL may be incorrect or the file may have been removed.';
      } else if (statusCode === 400) {
        errorMessage += ' Note: The URL may be malformed or the server may be rejecting the request.';
      }

      throw new NodeOperationError(this.executeFunctions.getNode(), errorMessage);
    }
  }

  /**
   * Validate downloaded file size
   */
  private validateFileSize(buffer: Buffer, index: number, mimeType: string): void {
    // Determine max size based on file type
    const isVideo = Object.values(VIDEO_MIME_TYPES).includes(mimeType);
    const maxSize = isVideo ? getMaxVideoSizeBytes() : getMaxImageSizeBytes();

    if (buffer.length > maxSize) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Downloaded file size (${formatBytes(buffer.length)}) exceeds maximum allowed size of ${formatBytes(maxSize)}`
      );
    }
  }

  /**
   * Get file extension from URL
   */
  private getFileExtensionFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = pathname.split('.').pop()?.toLowerCase();
      return ext || 'png';
    } catch {
      // If URL parsing fails, try to extract extension directly
      const ext = url.split('.').pop()?.toLowerCase();
      return ext || 'png';
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(ext: string): string {
    const imageMimeType = IMAGE_MIME_TYPES[ext];
    const videoMimeType = VIDEO_MIME_TYPES[ext];
    return videoMimeType || imageMimeType || 'image/png';
  }

  /**
   * Find binary data in input items
   */
  private findBinaryData(binaryPropertyName: string, index: number): {
    binaryData: BinaryData | null;
    availableKeys: string[];
  } {
    const inputData = this.executeFunctions.getInputData(0);

    if (!inputData || inputData.length === 0) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: No input data available.`
      );
    }

    let binaryData: BinaryData | null = null;
    const allAvailableKeys: string[] = [];

    for (let i = 0; i < inputData.length; i++) {
      const item = inputData[i];
      if (item?.binary) {
        const keys = Object.keys(item.binary);
        allAvailableKeys.push(...keys);

        if (item.binary[binaryPropertyName]) {
          binaryData = item.binary[binaryPropertyName] as BinaryData;
          break;
        }
      }
    }

    return { binaryData, availableKeys: allAvailableKeys };
  }

  /**
   * Validate binary data structure and content
   */
  private validateBinaryData(
    binaryData: BinaryData | null,
    binaryPropertyName: string,
    index: number,
    availableKeys: string[]
  ): void {
    if (binaryData === null) {
      const uniqueKeys = [...new Set(availableKeys)].join(', ');
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Binary property "${binaryPropertyName}" not found in any input item.\n\n` +
        `Available binary properties: ${uniqueKeys || 'none'}\n\n` +
        `TIP: Check the previous nodes' "Output Binary Key" parameters.`
      );
    }

    if (!binaryData.data || typeof binaryData.data !== 'string') {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Invalid binary data for property "${binaryPropertyName}". The data field is missing or not a string.`
      );
    }

    const maxBase64Length = getMaxBase64Length();

    if (binaryData.data.length > maxBase64Length) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Binary data exceeds maximum allowed size of ${formatBytes(binaryData.data.length * BASE64_DECODE_FACTOR)}`
      );
    }

    if (!binaryData.mimeType || typeof binaryData.mimeType !== 'string') {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Invalid or missing MIME type for binary data.`
      );
    }

    const mimeType = binaryData.mimeType.toLowerCase();
    const allowedMimeTypes = [...Object.values(IMAGE_MIME_TYPES), ...Object.values(VIDEO_MIME_TYPES)];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Unsupported MIME type "${mimeType}". Allowed types: ${allowedMimeTypes.join(', ')}`
      );
    }
  }

  /**
   * Decode base64 binary data to buffer
   */
  private decodeBinaryData(binaryData: BinaryData, index: number): Buffer {
    const buffer = Buffer.from(binaryData.data, 'base64');

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Failed to decode binary data. Buffer length: ${buffer.length}`
      );
    }

    return buffer;
  }

  /**
   * Validate decoded buffer size
   */
  private validateDecodedBuffer(buffer: Buffer, binaryPropertyName: string, index: number, mimeType?: string): void {
    // Determine max size based on file type
    const isVideo = mimeType ? Object.values(VIDEO_MIME_TYPES).includes(mimeType) : false;
    const maxBufferSize = isVideo ? getMaxVideoSizeBytes() : getMaxImageSizeBytes();

    if (buffer.length > maxBufferSize) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Decoded buffer for "${binaryPropertyName}" (${formatBytes(buffer.length)}) exceeds maximum allowed size of ${formatBytes(maxBufferSize)}`
      );
    }
  }
}
