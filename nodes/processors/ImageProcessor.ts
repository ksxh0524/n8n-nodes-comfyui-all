/**
 * Image Processor - Handles image parameter processing
 * Supports both URL download and binary data upload
 */

import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import type { BinaryData } from '../types';
import { Logger } from '../logger';
import { validateUrl } from '../validation';
import { generateUniqueFilename, getMaxImageSizeBytes, formatBytes, getMaxBase64Length } from '../utils';
import { IMAGE_MIME_TYPES, BASE64_DECODE_FACTOR } from '../constants';

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
   * Process image from URL - download and upload to ComfyUI
   * Uses configuration object instead of multiple parameters
   */
  async processFromUrl(config: ProcessFromUrlConfig): Promise<ImageUploadResult> {
    const { paramName, imageUrl, index, uploadImage, timeout } = config;

    this.validateImageUrl(imageUrl, index);
    await this.validateImageUrlFormat(imageUrl, index);

    this.logger.info(`Downloading image from URL`, { url: imageUrl, paramName });

    const imageBuffer = await this.downloadImage(imageUrl, index, timeout);
    this.validateImageSize(imageBuffer, index);

    const filename = generateUniqueFilename('png', 'download');
    this.logger.info(`Uploading image to ComfyUI`, { filename, size: imageBuffer.length });

    const uploadedFilename = await uploadImage(imageBuffer, filename);

    this.logger.info(`Successfully uploaded image`, { paramName, filename: uploadedFilename });

    return { filename: uploadedFilename, size: imageBuffer.length };
  }

  /**
   * Process image from binary data - extract from input and upload to ComfyUI
   * Uses configuration object instead of multiple parameters
   */
  async processFromBinary(config: ProcessFromBinaryConfig): Promise<ImageUploadResult> {
    const { paramName, binaryPropertyName, index, uploadImage } = config;

    // Tool mode doesn't support binary input
    if (this.isToolMode) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Binary image input is not supported in Tool mode. Please use URL input instead.`
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
    this.validateDecodedBuffer(buffer, binaryPropertyName || 'data', index);

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
   * Validate image URL is provided
   */
  private validateImageUrl(imageUrl: string, index: number): void {
    if (!imageUrl) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Image URL is required when Image Input Type is set to URL.`
      );
    }
  }

  /**
   * Validate URL format (allows private network addresses for internal use)
   */
  private async validateImageUrlFormat(imageUrl: string, index: number): Promise<void> {
    try {
      if (!validateUrl(imageUrl)) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Invalid image URL "${imageUrl}". ` +
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
   * Download image from URL
   */
  private async downloadImage(imageUrl: string, index: number, timeout: number): Promise<Buffer> {
    try {
      const imageResponse = await this.executeFunctions.helpers.httpRequest({
        method: 'GET',
        url: imageUrl,
        encoding: 'arraybuffer',
        timeout: timeout * 1000,
      });

      if (!imageResponse || !Buffer.isBuffer(imageResponse)) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Failed to download image from URL "${imageUrl}". The server did not return valid image data.`
        );
      }

      const imageBuffer = Buffer.from(imageResponse);

      if (imageBuffer.length === 0) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Downloaded image from URL "${imageUrl}" is empty.`
        );
      }

      this.logger.info(`Successfully downloaded image`, { size: imageBuffer.length, url: imageUrl });
      return imageBuffer;

    } catch (error: unknown) {
      if (error instanceof NodeOperationError) {
        throw error;
      }

      const httpError = error as { response?: { statusCode?: number; statusMessage?: string } };
      const statusCode = httpError.response?.statusCode;
      const statusMessage = httpError.response?.statusMessage;

      let errorMessage = `Node Parameters ${index + 1}: Failed to download image from URL "${imageUrl}"`;
      if (statusCode) {
        errorMessage += ` (HTTP ${statusCode} ${statusMessage || ''})`;
      }

      // Add helpful hints for common error codes
      if (statusCode === 403) {
        errorMessage += ' Note: The URL may require authentication or block automated access.';
      } else if (statusCode === 404) {
        errorMessage += ' Note: The URL may be incorrect or the image may have been removed.';
      } else if (statusCode === 400) {
        errorMessage += ' Note: The URL may be malformed or the server may be rejecting the request.';
      }

      throw new NodeOperationError(this.executeFunctions.getNode(), errorMessage);
    }
  }

  /**
   * Validate downloaded image size
   */
  private validateImageSize(buffer: Buffer, index: number): void {
    const maxImageSize = getMaxImageSizeBytes();

    if (buffer.length > maxImageSize) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Downloaded image size (${formatBytes(buffer.length)}) exceeds maximum allowed size of ${formatBytes(maxImageSize)}`
      );
    }
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
    const allowedMimeTypes = Object.values(IMAGE_MIME_TYPES);

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
  private validateDecodedBuffer(buffer: Buffer, binaryPropertyName: string, index: number): void {
    const maxBufferSize = getMaxImageSizeBytes();

    if (buffer.length > maxBufferSize) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Decoded buffer for "${binaryPropertyName}" (${formatBytes(buffer.length)}) exceeds maximum allowed size of ${formatBytes(maxBufferSize)}`
      );
    }
  }
}
