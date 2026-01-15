/**
 * Parameter Type Handler - Handles different parameter types
 * Supports text, number, boolean, image, and file parameters
 */

import { NodeOperationError } from 'n8n-workflow';
import type { IExecuteFunctions } from 'n8n-workflow';
import { ImageProcessor } from './ImageProcessor';
import { Logger } from '../logger';

export interface TypeHandlerConfig {
  executeFunctions: IExecuteFunctions;
  logger: Logger;
  imageProcessor: ImageProcessor;
}

/**
 * Configuration object for processing parameters by type
 */
export interface ProcessByTypeConfig {
  type: string;
  nodeId: string;
  paramName: string;
  value: string;
  numberValue: number;
  booleanValue: string | boolean;
  imageSource: string;
  imageUrl: string;
  index: number;
  uploadImage: (buffer: Buffer, filename: string) => Promise<string>;
  timeout: number;
}

/**
 * Handles processing of different parameter types
 */
export class ParameterTypeHandler {
  private executeFunctions: IExecuteFunctions;
  private logger: Logger;
  private imageProcessor: ImageProcessor;

  constructor(config: TypeHandlerConfig) {
    this.executeFunctions = config.executeFunctions;
    this.logger = config.logger;
    this.imageProcessor = config.imageProcessor;
  }

  /**
   * Process text parameter
   */
  processText(value: string): string {
    return value || '';
  }

  /**
   * Process number parameter
   */
  processNumber(value: number | null | undefined): number {
    return (value !== undefined && value !== null) ? value : 0;
  }

  /**
   * Normalize boolean value to native boolean type
   * Handles string ('true'/'false') and boolean inputs
   *
   * @param value - Value to normalize (string or boolean)
   * @returns Native boolean value
   *
   * @example
   * ```typescript
   * normalizeBoolean('true')    // true
   * normalizeBoolean('false')   // false
   * normalizeBoolean(true)      // true
   * normalizeBoolean(false)     // false
   * normalizeBoolean('yes')     // false (strict parsing)
   * ```
   */
  normalizeBoolean(value: string | boolean): boolean {
    // Handle boolean type
    if (typeof value === 'boolean') {
      return value;
    }

    // Handle string type (strict parsing)
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    // Default to false for any other type
    return false;
  }

  /**
   * Process boolean parameter
   * Uses normalized boolean value for type safety
   */
  processBoolean(value: string | boolean): boolean {
    return this.normalizeBoolean(value);
  }

  /**
   * Process image parameter (delegates to ImageProcessor)
   */
  async processImage(config: {
    nodeId: string;
    paramName: string;
    imageSource: string;
    imageUrl: string;
    value: string;
    index: number;
    uploadImage: (buffer: Buffer, filename: string) => Promise<string>;
    timeout: number;
  }): Promise<string> {
    const { nodeId, paramName, imageSource, imageUrl, value, index, uploadImage, timeout } = config;

    this.logger.info(`Processing image parameter for node ${nodeId}`, {
      paramName,
      imageSource,
      imageUrl: imageUrl || 'N/A',
      value: value || 'N/A'
    });

    if (imageSource === 'url') {
      const result = await this.imageProcessor.processFromUrl({
        paramName,
        imageUrl,
        index,
        uploadImage,
        timeout,
      });
      return result.filename;
    } else {
      const result = await this.imageProcessor.processFromBinary({
        paramName,
        binaryPropertyName: value,
        index,
        uploadImage,
      });
      return result.filename;
    }
  }

  /**
   * Process parameter based on type using configuration object
   */
  async processByType(config: ProcessByTypeConfig): Promise<unknown> {
    const { type, nodeId, paramName, value, numberValue, booleanValue, imageSource, imageUrl, index, uploadImage, timeout } = config;

    switch (type) {
      case 'text':
        return this.processText(value);

      case 'number':
        return this.processNumber(numberValue);

      case 'boolean':
        return this.processBoolean(booleanValue);

      case 'file':
        return await this.processImage({
          nodeId,
          paramName,
          imageSource,
          imageUrl,
          value,
          index,
          uploadImage,
          timeout,
        });

      default:
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Unknown type "${type}"`
        );
    }
  }
}
