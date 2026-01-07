import {
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';

import { ComfyUIClient } from '../ComfyUiClient';
import { validateUrl, validateComfyUIWorkflow, safeJsonParse } from '../validation';
import { NodeParameterInput } from '../types';
import { VALIDATION, IMAGE_MIME_TYPES, DEFAULT_OUTPUT_BINARY_KEY } from '../constants';
import { createLogger } from '../logger';
import { validateFilename, generateUniqueFilename } from '../utils';

export class ComfyUi {
  /**
   * Node description for n8n
   * Defines the node's properties, inputs, outputs, and configuration options
   */
  description = {
    displayName: 'ComfyUI',
    name: 'comfyUi',
    icon: 'file:comfyui.svg',
    iconColor: '#FF6B6B',
    group: ['transform'],
    version: [1],
    defaultVersion: 1,
    description: 'Generate images, videos, and more using ComfyUI.',
    defaults: {
      name: 'ComfyUI',
    },
    usableAsTool: true,
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'ComfyUI URL',
        name: 'comfyUiUrl',
        type: 'string',
        required: true,
        default: 'http://127.0.0.1:8188',
        description: 'URL of ComfyUI server',
      },
      {
        displayName: 'Workflow JSON',
        name: 'workflowJson',
        type: 'string',
        typeOptions: {
          rows: 20,
        },
        required: true,
        default: '',
        description: 'Paste your ComfyUI workflow JSON (API Format). In ComfyUI: 1. Design your workflow 2. Click "Save (API Format)" to export 3. Copy generated JSON 4. Paste it here. Tip: Configure all parameters directly in JSON (prompts, resolution, sampling parameters, frames, etc.).',
        placeholder: 'Paste your ComfyUI workflow JSON...\n\n{\n  "3": {\n    "inputs": {\n      "seed": 123456789,\n      "steps": 20,\n      ...\n    },\n    "class_type": "KSampler"\n  }\n}',
        hint: 'Copy API Format workflow from ComfyUI and paste it here. You can edit all parameters directly in JSON.',
      },
      {
        displayName: 'Timeout (Seconds)',
        name: 'timeout',
        type: 'number',
        default: 300,
        description: 'Maximum time to wait for workflow execution (in seconds). Default: 300 (5 minutes).',
        minValue: 10,
        maxValue: 3600,
      },
      {
        displayName: 'Output Binary Key',
        name: 'outputBinaryKey',
        type: 'string',
        default: 'data',
        description: 'Property name for the first output binary data (e.g., "data", "image", "output")',
        placeholder: 'data',
      },
      {
        displayName: 'Node Parameters',
        name: 'nodeParameters',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
          sortable: true,
        },
        description: 'Override parameters for a node. Click the arrow icon (▼) on each parameter item to collapse/expand it.',
        default: {},
        options: [
          {
            displayName: 'Node Parameter',
            name: 'nodeParameter',
            values: [
											{
												displayName: 'Node ID',
												name: 'nodeId',
												type: 'string',
												default: '',
												description: 'The node ID in your workflow (e.g., \'13\', \'3\', \'6\')',
												placeholder: '13',
												required: true,
											},
											{
												displayName: 'Parameter Mode',
												name: 'parameterMode',
												type: 'options',
												default: 'single',
												description: 'Choose how to configure parameters',
												options: [
													{
														name: 'Single Parameter',
														value: 'single',
														description: 'Configure one parameter at a time',
													},
													{
														name: 'Multiple Parameters',
														value: 'multiple',
														description: 'Configure multiple parameters at once using JSON',
													},
												]
											},
											{
												displayName: 'Parameter Name',
												name: 'paramName',
												type: 'string',
												default: '',
												description: 'The parameter name to override (e.g., \'text\', \'seed\', \'steps\', \'width\'). Use this for single parameter mode.',
												placeholder: 'width',
												displayOptions: {
													show: {
														parameterMode: ['single'],
													},
												},
											},
											{
												displayName: 'Parameters JSON',
												name: 'parametersJson',
												type: 'string',
												typeOptions: {
													rows: 10,
												},
												default: '',
												description: 'JSON object containing all parameters for this node. Example: {\'width\': 1024, \'height\': 1024, \'batch_size\': 1}. Use this to configure multiple parameters at once.',
												placeholder: '{\n  \'width\': 1024,\n  \'height\': 1024,\n  \'batch_size\': 1\n}',
												displayOptions: {
													show: {
														parameterMode: ['multiple'],
													},
												},
											},
											{
												displayName: 'Type',
												name: 'type',
												type: 'options',
												default: 'text',
												description: 'Data type of parameter (for single parameter mode)',
												options: [
													{
														name: 'Text',
														value: 'text',
														description: 'String/text value',
													},
													{
														name: 'Number',
														value: 'number',
														description: 'Numeric value',
													},
													{
														name: 'Boolean',
														value: 'boolean',
														description: 'True/False',
													},
													{
														name: 'Image',
														value: 'image',
														description: 'Image file (from binary data or URL)',
													},
													],
												displayOptions: {
													show: {
														parameterMode: ['single'],
													},
												},
											},
											{
												displayName: 'Image Input Type',
												name: 'imageSource',
												type: 'options',
												default: 'url',
												description: 'How to input the image',
												options: [
													{
														name: 'URL',
														value: 'url',
														description: 'Download from URL',
													},
													{
														name: 'Binary',
														value: 'binary',
														description: 'Use binary data from input',
													},
												],
												displayOptions: {
													show: {
														parameterMode: ['single'],
														type: ['image'],
													},
												},
											},
											{
												displayName: 'Image URL',
												name: 'imageUrl',
												type: 'string',
												default: '',
												description: 'URL of the image to download and upload to ComfyUI',
												placeholder: 'https://example.com/image.png',
												displayOptions: {
													show: {
														parameterMode: ['single'],
														type: ['image'],
														imageSource: ['url'],
													},
												},
												hint: 'Enter the URL of the image to use',
											},
											{
												displayName: 'Value',
												name: 'value',
												type: 'string',
												default: '',
												description: 'The value to set',
												placeholder: 'Enter text...',
												displayOptions: {
													show: {
														parameterMode: ['single'],
														type: ['text'],
													},
												},
											},
											{
												displayName: 'Value',
												name: 'value',
												type: 'string',
												default: '',
												description: 'Binary property name from input data (e.g., "data", "image", "file")',
												placeholder: 'data',
												displayOptions: {
													show: {
														parameterMode: ['single'],
														type: ['image'],
														imageSource: ['binary'],
													},
												},
												hint: 'Enter the binary property name to use as input',
											},
											{
												displayName: 'Value',
												name: 'numberValue',
												type: 'number',
												default: 0,
												description: 'The numeric value to set',
												placeholder: 'Enter number...',
												displayOptions: {
													show: {
														parameterMode: ['single'],
														type: ['number'],
													},
												},
											},
											{
												displayName: 'Value',
												name: 'booleanValue',
												type: 'options',
												default: 'false',
												description: 'The boolean value to set',
												options: [
													{
														name: 'True',
														value: 'true',
														description: 'Enable/set to true',
													},
													{
														name: 'False',
														value: 'false',
														description: 'Disable/set to false',
													},
													],
												displayOptions: {
													show: {
														parameterMode: ['single'],
														type: ['boolean'],
													},
												},
											},
									],
          },
        ],
      },
    ],
  };

  /**
   * Execute the ComfyUI workflow
   * @returns Promise containing the execution results with image/video data
   * @throws {NodeOperationError} If URL validation, workflow validation, or execution fails
   */
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const logger = createLogger(this.logger);
    const comfyUiUrl = this.getNodeParameter('comfyUiUrl', 0) as string;
    const workflowJson = this.getNodeParameter('workflowJson', 0) as string;
    const timeout = this.getNodeParameter('timeout', 0) as number;
    const outputBinaryKey = this.getNodeParameter('outputBinaryKey', 0) as string || DEFAULT_OUTPUT_BINARY_KEY;

    if (!validateUrl(comfyUiUrl)) {
      throw new NodeOperationError(this.getNode(), 'Invalid ComfyUI URL. Must be a valid HTTP/HTTPS URL.');
    }

    const workflowValidation = validateComfyUIWorkflow(workflowJson);
    if (!workflowValidation.valid) {
      throw new NodeOperationError(this.getNode(), `Invalid ComfyUI workflow: ${workflowValidation.error}. Please ensure you export your workflow in API format from ComfyUI.`);
    }

    let workflow;
    try {
      workflow = safeJsonParse(workflowJson, 'Workflow JSON');
    } catch (error) {
      throw new NodeOperationError(this.getNode(), `Failed to parse workflow JSON: ${error}. Please ensure the JSON is valid.`);
    }

    const client = new ComfyUIClient({
      baseUrl: comfyUiUrl,
      timeout: timeout * 1000,
      helpers: this.helpers,
      logger: logger,
    });

    logger.info('Starting ComfyUI workflow execution', { url: comfyUiUrl, timeout });

    try {
      const nodeParametersInput = this.getNodeParameter('nodeParameters', 0) as NodeParameterInput;
      if (nodeParametersInput && nodeParametersInput.nodeParameter && Array.isArray(nodeParametersInput.nodeParameter)) {
        logger.debug(`Processing ${nodeParametersInput.nodeParameter.length} node parameter overrides`);

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
            throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1} is missing Node ID.`);
          }

          if (!workflow[nodeId]) {
            throw new NodeOperationError(this.getNode(), `Node ID "${nodeId}" not found in workflow. Please check your workflow JSON.`);
          }

          if (!workflow[nodeId].inputs) {
            workflow[nodeId].inputs = {};
          }

          if (parameterMode === 'multiple' && parametersJson) {
            let parameters: Record<string, any>;
            try {
              parameters = safeJsonParse(parametersJson, `Node Parameters ${i + 1}`);
            } catch (error: any) {
              throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: ${error.message}`);
            }

            if (typeof parameters !== 'object' || parameters === null) {
              throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Parameters must be a JSON object`);
            }

            logger.debug(`Applying multiple parameters to node ${nodeId}`, { parameters });

            for (const [key, val] of Object.entries(parameters)) {
              workflow[nodeId].inputs[key] = val;
            }
          } else if (parameterMode === 'single' && paramName) {
            if (!type) {
              throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Type is required for single parameter mode.`);
            }

            let parsedValue: any;

            switch (type) {
              case 'text':
                parsedValue = value || '';
                workflow[nodeId].inputs[paramName] = parsedValue;
                break;

              case 'number':
                parsedValue = numberValue !== undefined ? numberValue : 0;
                workflow[nodeId].inputs[paramName] = parsedValue;
                break;

              case 'boolean':
                parsedValue = booleanValue === 'true' || booleanValue === true;
                workflow[nodeId].inputs[paramName] = parsedValue;
                break;

              case 'image':
                logger.info(`Processing image parameter for node ${nodeId}`, { paramName, imageSource, imageUrl: imageUrl || 'N/A', value: value || 'N/A' });

                if (imageSource === 'url') {
                  if (!imageUrl) {
                    throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Image URL is required when Image Input Type is set to URL.`);
                  }

                  if (!validateUrl(imageUrl)) {
                    throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Invalid image URL "${imageUrl}". Must be a valid HTTP/HTTPS URL.`);
                  }

                  logger.info(`Downloading image from URL`, { url: imageUrl, paramName });
                  try {
                    const imageResponse = await this.helpers.httpRequest({
                      method: 'GET',
                      url: imageUrl,
                      encoding: 'arraybuffer',
                      timeout: timeout * 1000,
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                      },
                    });

                    if (!imageResponse || !Buffer.isBuffer(imageResponse)) {
                      throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Failed to download image from URL "${imageUrl}". The server did not return valid image data. Please check the URL and try again.`);
                    }

                    const imageBuffer = Buffer.from(imageResponse);

                    if (imageBuffer.length === 0) {
                      throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Downloaded image from URL "${imageUrl}" is empty. Please check the URL and try again.`);
                    }

                    // Validate downloaded image size
                    const maxImageSize = VALIDATION.MAX_IMAGE_SIZE_MB * 1024 * 1024;
                    if (imageBuffer.length > maxImageSize) {
                      throw new NodeOperationError(
                        this.getNode(),
                        `Node Parameters ${i + 1}: Downloaded image size (${Math.round(imageBuffer.length / 1024 / 1024)}MB) exceeds maximum allowed size of ${VALIDATION.MAX_IMAGE_SIZE_MB}MB`
                      );
                    }

                    logger.info(`Successfully downloaded image`, { size: imageBuffer.length, url: imageUrl });

                    let filename = imageUrl.split('/').pop() || `download_${Date.now()}.png`;
                    if (filename.includes('?')) {
                      filename = filename.split('?')[0];
                    }

                    if (!filename.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
                      filename = generateUniqueFilename('png', 'download');
                    } else {
                      try {
                        filename = validateFilename(filename);
                      } catch (error: any) {
                        logger.warn(`Invalid filename "${filename}", generating unique filename`, { error: error.message });
                        filename = generateUniqueFilename('png', 'download');
                      }
                    }

                    logger.info(`Uploading image to ComfyUI`, { filename, size: imageBuffer.length });
                    const uploadedFilename = await client.uploadImage(imageBuffer, filename);

                    parsedValue = uploadedFilename;
                    workflow[nodeId].inputs[paramName] = parsedValue;

                    logger.info(`Successfully uploaded image to ComfyUI`, { paramName, filename: uploadedFilename });
                  } catch (error: any) {
                    if (error instanceof NodeOperationError) {
                      throw error;
                    }

                    const statusCode = error.response?.statusCode || error.statusCode;
                    const statusMessage = error.response?.statusMessage || error.statusMessage;
                    let errorMessage = `Node Parameters ${i + 1}: Failed to download image from URL "${imageUrl}"`;
                    if (statusCode) {
                      errorMessage += ` (HTTP ${statusCode} ${statusMessage || ''})`;
                    }
                    errorMessage += `. ${error.message}`;

                    if (statusCode === 403) {
                      errorMessage += ' Note: The URL may require authentication or block automated access. Try downloading the image manually and using Binary mode instead.';
                    } else if (statusCode === 404) {
                      errorMessage += ' Note: The URL may be incorrect or the image may have been removed.';
                    } else if (statusCode === 400) {
                      errorMessage += ' Note: The URL may be malformed or the server may be rejecting the request. Try using a different URL or download the image manually and use Binary mode.';
                    }

                    throw new NodeOperationError(this.getNode(), errorMessage);
                  }
                } else {
                  logger.info(`Getting binary data from input`, { binaryProperty: value || 'data', paramName });
                  const inputData = this.getInputData(0);
                  const binaryPropertyName = value || 'data';

                  if (!inputData || !inputData[0] || !inputData[0].binary || !inputData[0].binary[binaryPropertyName]) {
                    const availableKeys = inputData && inputData[0] && inputData[0].binary ? Object.keys(inputData[0].binary).join(', ') : 'none';
                    throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Binary property "${binaryPropertyName}" not found in input data.

Available binary properties: ${availableKeys}

TIP: Check the previous node's "Output Binary Key" parameter. It should match "${binaryPropertyName}".`);
                  }

                  const binaryData = inputData[0].binary[binaryPropertyName];

                  if (!binaryData.data || typeof binaryData.data !== 'string') {
                    throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Invalid binary data for property "${binaryPropertyName}". The data field is missing or not a string.`);
                  }

                  // Validate base64 string length before decoding
                  const base64Data = binaryData.data;
                  const maxBase64Length = VALIDATION.MAX_IMAGE_SIZE_MB * 1024 * 1024 * 4 / 3; // Base64 is ~33% larger than binary

                  if (base64Data.length > maxBase64Length) {
                    throw new NodeOperationError(
                      this.getNode(),
                      `Node Parameters ${i + 1}: Binary data exceeds maximum allowed size of ${VALIDATION.MAX_IMAGE_SIZE_MB}MB. ` +
                      `Base64 data length: ${Math.round(base64Data.length / 1024 / 1024)}MB (decoded would be ~${Math.round(base64Data.length * 0.75 / 1024 / 1024)}MB)`
                    );
                  }

                  // Validate MIME type
                  if (!binaryData.mimeType || typeof binaryData.mimeType !== 'string') {
                    throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Invalid or missing MIME type for binary data.`);
                  }

                  const mimeType = binaryData.mimeType.toLowerCase();
                  const allowedMimeTypes = Object.values(IMAGE_MIME_TYPES);

                  if (!allowedMimeTypes.includes(mimeType)) {
                    throw new NodeOperationError(
                      this.getNode(),
                      `Node Parameters ${i + 1}: Unsupported MIME type "${mimeType}". ` +
                      `Allowed types: ${allowedMimeTypes.join(', ')}`
                    );
                  }

                  const ext = binaryData.mimeType.split('/')[1] || 'png';
                  const filename = binaryData.fileName || generateUniqueFilename(ext, 'upload');

                  const buffer = Buffer.from(base64Data, 'base64');

                  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
                    throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Failed to decode binary data for property "${binaryPropertyName}". The data may be corrupted. Buffer length: ${buffer.length}`);
                  }

                  const maxBufferSize = VALIDATION.MAX_IMAGE_SIZE_MB * 1024 * 1024;
                  if (buffer.length > maxBufferSize) {
                    throw new NodeOperationError(
                      this.getNode(),
                      `Node Parameters ${i + 1}: Decoded buffer size (${Math.round(buffer.length / 1024 / 1024)}MB) exceeds maximum allowed size of ${VALIDATION.MAX_IMAGE_SIZE_MB}MB`
                    );
                  }

                  logger.info(`Uploading binary data to ComfyUI`, { filename, size: buffer.length, mimeType: binaryData.mimeType, paramName });
                  const uploadedFilename = await client.uploadImage(buffer, filename);

                  parsedValue = uploadedFilename;
                  workflow[nodeId].inputs[paramName] = parsedValue;

                  logger.info(`Successfully uploaded binary data`, { paramName, filename: uploadedFilename });
                }
                break;

              default:
                throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: Unknown type "${type}"`);
            }

            logger.debug(`Applying single parameter to node ${nodeId}`, { paramName, value: parsedValue });
          } else {
            throw new NodeOperationError(this.getNode(), `Node Parameters ${i + 1}: For Multiple Parameters mode, provide Parameters JSON. For Single Parameter mode, provide Parameter Name and Value.`);
          }
        }
      }

      // Log workflow before execution
      logger.info('Prepared workflow for execution', {
        nodeCount: Object.keys(workflow).length,
        comfyUiUrl,
        workflow: JSON.stringify(workflow, null, 2),
      });

      logger.info('Executing ComfyUI workflow', { nodeCount: Object.keys(workflow).length, comfyUiUrl });
      const result = await client.executeWorkflow(workflow);

      if (!result.success) {
        logger.error('Workflow execution failed', result.error);
        throw new NodeOperationError(this.getNode(), `Failed to execute workflow: ${result.error}`);
      }

      const { json, binary } = await client.processResults(result, outputBinaryKey);

      logger.info('Workflow execution completed successfully', {
        imageCount: json.imageCount,
        videoCount: json.videoCount,
      });

      return [this.helpers.constructExecutionMetaData(
        [{ json, binary }],
        { itemData: { item: 0 } }
      )];
    } catch (error) {
      logger.error('Error during workflow execution', error);
      throw error;
    } finally {
      client.destroy();
      logger.debug('Client destroyed');
    }
  }
}
