/**
 * Parameter Type Handler - Handles different parameter types
 * Supports text, number, boolean, and image parameters
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
  processNumber(value: number): number {
    return value !== undefined ? value : 0;
  }

  /**
   * Process boolean parameter
   * Accepts both string and boolean types for flexibility
   */
  processBoolean(value: string | boolean): boolean {
    return value === 'true' || value === true;
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

      case 'image':
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
