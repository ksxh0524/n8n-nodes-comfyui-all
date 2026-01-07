import { IExecuteFunctions, NodeOperationError } from 'n8n-workflow';
import { NodeParameterConfig, Workflow } from './types';
import { safeJsonParse } from './validation';
import { Logger } from './logger';

export interface ParameterProcessorConfig {
  executeFunctions: IExecuteFunctions;
  logger: Logger;
}

export class ParameterProcessor {
  private executeFunctions: IExecuteFunctions;
  private logger: Logger;

  constructor(config: ParameterProcessorConfig) {
    this.executeFunctions = config.executeFunctions;
    this.logger = config.logger;
  }

  processTextParameter(value: string): string {
    return value || '';
  }

  processNumberParameter(numberValue: number): number {
    return numberValue !== undefined ? numberValue : 0;
  }

  processBooleanParameter(booleanValue: string | boolean): boolean {
    return booleanValue === 'true' || booleanValue === true;
  }

  async processImageFromUrl(
    paramName: string,
    imageUrl: string,
    index: number,
    uploadImage: (buffer: Buffer, filename: string) => Promise<string>,
    timeout: number
  ): Promise<string> {
    if (!imageUrl) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Image URL is required when Image Input Type is set to URL.`
      );
    }

    const { validateUrl } = await import('./validation');
    if (!validateUrl(imageUrl)) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Invalid image URL "${imageUrl}". Must be a valid HTTP/HTTPS URL.`
      );
    }

    this.logger.info(`Downloading image from URL`, { url: imageUrl, paramName });
    try {
      const { validateFilename, generateUniqueFilename, getMaxImageSizeBytes, formatBytes } = await import('./utils');

      const imageResponse = await this.executeFunctions.helpers.httpRequest({
        method: 'GET',
        url: imageUrl,
        encoding: 'arraybuffer',
        timeout: timeout * 1000,
      });

      if (!imageResponse || !Buffer.isBuffer(imageResponse)) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Failed to download image from URL "${imageUrl}". The server did not return valid image data. Please check the URL and try again.`
        );
      }

      const imageBuffer = Buffer.from(imageResponse);

      if (imageBuffer.length === 0) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Downloaded image from URL "${imageUrl}" is empty. Please check the URL and try again.`
        );
      }

      const maxImageSize = getMaxImageSizeBytes();
      if (imageBuffer.length > maxImageSize) {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${index + 1}: Downloaded image size (${formatBytes(imageBuffer.length)}) exceeds maximum allowed size of ${formatBytes(maxImageSize)}`
        );
      }

      this.logger.info(`Successfully downloaded image`, { size: imageBuffer.length, url: imageUrl });
      
      let filename = imageUrl.split('/').pop() || generateUniqueFilename('png', 'download');
      if (filename.includes('?')) {
        filename = filename.split('?')[0];
      }
      
      // Detect image format from URL or use default
      if (!filename.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
        filename = generateUniqueFilename('png', 'download');
      } else {
        try {
          filename = validateFilename(filename);
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Invalid filename "${filename}", generating unique filename`, { error: errorMsg });
          filename = generateUniqueFilename('png', 'download');
        }
      }
      
      this.logger.info(`Uploading image to ComfyUI`, { filename, size: imageBuffer.length });
      const uploadedFilename = await uploadImage(imageBuffer, filename);

      this.logger.info(`Successfully uploaded image to ComfyUI`, { paramName, filename: uploadedFilename });
      return uploadedFilename;
    } catch (error: unknown) {
      if (error instanceof NodeOperationError) {
        throw error;
      }

      const httpError = error as { response?: { statusCode?: number; statusMessage?: string } };
      const statusCode = httpError.response?.statusCode;
      const statusMessage = httpError.response?.statusMessage;
      let errorDetail = '';
      
      if (error instanceof Error) {
        errorDetail = error.message;
      } else if (error && typeof error === 'object') {
        errorDetail = JSON.stringify(error);
      } else {
        errorDetail = String(error);
      }
      
      let errorMessage = `Node Parameters ${index + 1}: Failed to download image from URL "${imageUrl}"`;
      if (statusCode) {
        errorMessage += ` (HTTP ${statusCode} ${statusMessage || ''})`;
      }
      errorMessage += `. ${errorDetail}`;

      if (statusCode === 403) {
        errorMessage += ' Note: The URL may require authentication or block automated access. Try downloading the image manually and using Binary mode instead.';
      } else if (statusCode === 404) {
        errorMessage += ' Note: The URL may be incorrect or the image may have been removed.';
      } else if (statusCode === 400) {
        errorMessage += ' Note: The URL may be malformed or the server may be rejecting the request. Try using a different URL or download the image manually and use Binary mode.';
      }

      throw new NodeOperationError(this.executeFunctions.getNode(), errorMessage);
    }
  }

  async processImageFromBinary(
    paramName: string,
    value: string,
    index: number,
    uploadImage: (buffer: Buffer, filename: string) => Promise<string>
  ): Promise<string> {
    this.logger.info(`Getting binary data from input`, { binaryProperty: value || 'data', paramName });
    const inputData = this.executeFunctions.getInputData(0);
    const binaryPropertyName = value || 'data';

    if (!inputData || !inputData[0] || !inputData[0].binary || !inputData[0].binary[binaryPropertyName]) {
      const availableKeys = inputData && inputData[0] && inputData[0].binary ? Object.keys(inputData[0].binary).join(', ') : 'none';
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Binary property "${binaryPropertyName}" not found in input data.

Available binary properties: ${availableKeys}

TIP: Check the previous node's "Output Binary Key" parameter. It should match "${binaryPropertyName}".`
      );
    }

    const binaryData = inputData[0].binary[binaryPropertyName];

    if (!binaryData.data || typeof binaryData.data !== 'string') {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Invalid binary data for property "${binaryPropertyName}". The data field is missing or not a string.`
      );
    }

    const { IMAGE_MIME_TYPES, BASE64_DECODE_FACTOR } = await import('./constants');
    const { generateUniqueFilename, getMaxBase64Length, getMaxImageSizeBytes, formatBytes } = await import('./utils');

    const base64Data = binaryData.data;
    const maxBase64Length = getMaxBase64Length();

    if (base64Data.length > maxBase64Length) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Binary data exceeds maximum allowed size of ${formatBytes(getMaxImageSizeBytes())}. ` +
        `Base64 data length: ${formatBytes(base64Data.length)} (decoded would be ~${formatBytes(base64Data.length * BASE64_DECODE_FACTOR)})`
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
        `Node Parameters ${index + 1}: Unsupported MIME type "${mimeType}". ` +
        `Allowed types: ${allowedMimeTypes.join(', ')}`
      );
    }

    const ext = binaryData.mimeType.split('/')[1] || 'png';
    const filename = binaryData.fileName || generateUniqueFilename(ext, 'upload');

    const buffer = Buffer.from(base64Data, 'base64');

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Failed to decode binary data for property "${binaryPropertyName}". The data may be corrupted. Buffer length: ${buffer.length}`
      );
    }

    const maxBufferSize = getMaxImageSizeBytes();
    if (buffer.length > maxBufferSize) {
      throw new NodeOperationError(
        this.executeFunctions.getNode(),
        `Node Parameters ${index + 1}: Decoded buffer size (${formatBytes(buffer.length)}) exceeds maximum allowed size of ${formatBytes(maxBufferSize)}`
      );
    }

    this.logger.info(`Uploading binary data to ComfyUI`, { filename, size: buffer.length, mimeType: binaryData.mimeType, paramName });
    const uploadedFilename = await uploadImage(buffer, filename);

    this.logger.info(`Successfully uploaded binary data`, { paramName, filename: uploadedFilename });
    return uploadedFilename;
  }

  async processImageParameter(
    nodeId: string,
    paramName: string,
    imageSource: string,
    imageUrl: string,
    value: string,
    index: number,
    uploadImage: (buffer: Buffer, filename: string) => Promise<string>,
    timeout: number
  ): Promise<string> {
    this.logger.info(`Processing image parameter for node ${nodeId}`, { paramName, imageSource, imageUrl: imageUrl || 'N/A', value: value || 'N/A' });

    if (imageSource === 'url') {
      return await this.processImageFromUrl(paramName, imageUrl, index, uploadImage, timeout);
    } else {
      return await this.processImageFromBinary(paramName, value, index, uploadImage);
    }
  }

  async processNodeParameters(
    nodeParametersInput: { nodeParameter?: NodeParameterConfig[] },
    workflow: Workflow,
    uploadImage: (buffer: Buffer, filename: string) => Promise<string>,
    timeout: number
  ): Promise<void> {
    if (!nodeParametersInput || !nodeParametersInput.nodeParameter || !Array.isArray(nodeParametersInput.nodeParameter)) {
      return;
    }

    this.logger.debug(`Processing ${nodeParametersInput.nodeParameter.length} node parameter overrides`);

    for (const [i, nodeParamConfig] of nodeParametersInput.nodeParameter.entries()) {
      const nodeId = nodeParamConfig.nodeId;
      const parameterMode = nodeParamConfig.parameterMode || 'single';
      const parametersJson = nodeParamConfig.parametersJson;
      const paramName = nodeParamConfig.paramName;
      const type = nodeParamConfig.type || 'text';
      const imageSource = nodeParamConfig.imageSource || 'binary';

      const value = nodeParamConfig.value || '';
      const numberValue = nodeParamConfig.numberValue ?? 0;
      const booleanValue = nodeParamConfig.booleanValue ?? 'false';
      const imageUrl = nodeParamConfig.imageUrl || '';

      if (!nodeId) {
        throw new NodeOperationError(this.executeFunctions.getNode(), `Node Parameters ${i + 1} is missing Node ID.`);
      }

      if (!workflow[nodeId]) {
        throw new NodeOperationError(this.executeFunctions.getNode(), `Node ID "${nodeId}" not found in workflow. Please check your workflow JSON.`);
      }

      if (!workflow[nodeId].inputs) {
        workflow[nodeId].inputs = {};
      }

      if (parameterMode === 'multiple' && parametersJson) {
        let parameters: Record<string, unknown>;
        try {
          parameters = safeJsonParse(parametersJson, `Node Parameters ${i + 1}`) as Record<string, unknown>;
        } catch (error: unknown) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          throw new NodeOperationError(this.executeFunctions.getNode(), `Node Parameters ${i + 1}: ${errorMsg}`);
        }

        if (typeof parameters !== 'object' || parameters === null) {
          throw new NodeOperationError(this.executeFunctions.getNode(), `Node Parameters ${i + 1}: Parameters must be a JSON object`);
        }

        this.logger.debug(`Applying multiple parameters to node ${nodeId}`, { parameters });

        for (const [key, val] of Object.entries(parameters)) {
          workflow[nodeId].inputs[key] = val;
        }
      } else if (parameterMode === 'single' && paramName) {
        if (!type) {
          throw new NodeOperationError(this.executeFunctions.getNode(), `Node Parameters ${i + 1}: Type is required for single parameter mode.`);
        }

        let parsedValue: unknown;

        switch (type) {
          case 'text':
            parsedValue = this.processTextParameter(value);
            workflow[nodeId].inputs[paramName] = parsedValue;
            break;

          case 'number':
            parsedValue = this.processNumberParameter(numberValue);
            workflow[nodeId].inputs[paramName] = parsedValue;
            break;

          case 'boolean':
            parsedValue = this.processBooleanParameter(booleanValue);
            workflow[nodeId].inputs[paramName] = parsedValue;
            break;

          case 'image':
            parsedValue = await this.processImageParameter(
              nodeId,
              paramName,
              imageSource,
              imageUrl,
              value,
              i,
              uploadImage,
              timeout
            );
            workflow[nodeId].inputs[paramName] = parsedValue;
            break;

          default:
            throw new NodeOperationError(this.executeFunctions.getNode(), `Node Parameters ${i + 1}: Unknown type "${type}"`);
        }

        this.logger.debug(`Applying single parameter to node ${nodeId}`, { paramName, value: parsedValue });
      } else {
        throw new NodeOperationError(
          this.executeFunctions.getNode(),
          `Node Parameters ${i + 1}: For Multiple Parameters mode, provide Parameters JSON. For Single Parameter mode, provide Parameter Name and Value.`
        );
      }
    }
  }
}
