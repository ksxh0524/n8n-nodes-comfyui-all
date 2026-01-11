/**
 * ComfyUI Tool - Simplified workflow execution node for AI Agents
 *
 * This is a simplified node designed for AI Agent usage. It executes
 * ComfyUI workflows provided by the user without making assumptions
 * about workflow structure or node types.
 */

import {
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';

import { ComfyUIClient } from '../ComfyUiClient';
import { validateUrl, validateComfyUIWorkflow } from '../validation';
import { Workflow, JsonData } from '../types';
import { createLogger } from '../logger';
import {
  updateNodeParameter,
} from '../agentToolHelpers';
import { parseWorkflow } from '../workflowConfig';
import { ParameterProcessor } from '../parameterProcessor';

export class ComfyUiTool {
  /**
   * Node description for n8n
   */
  description = {
    displayName: 'ComfyUI Tool',
    name: 'comfyUiTool',
    icon: 'file:comfyui.svg',
    iconColor: '#77C157',
    group: ['transform'],
    version: [1],
    defaultVersion: 1,
    description: 'Execute ComfyUI workflows. Requires a workflow JSON exported from ComfyUI.',
    defaults: {
      name: 'ComfyUI Tool',
    },
    usableAsTool: true,
    inputs: ['main'],
    outputs: ['main'],
    subtitle: 'ComfyUI Workflow Executor',
    notes: [
      'You must provide a ComfyUI workflow JSON (API Format)',
      'In ComfyUI: Design your workflow → Click "Save (API Format)" → Copy JSON → Paste here',
      'Works with ANY ComfyUI workflow: text-to-image, image-to-image, video generation, etc.',
      'Configure parameters directly in your workflow JSON or use parameter overrides',
    ],
    inputSample: {
      workflowJson: '{ "3": { "inputs": {}, "class_type": "KSampler" } }',
    },
    outputSample: {
      json: {
        success: true,
        imageCount: 1,
        imageUrls: ['http://127.0.0.1:8188/view?filename=ComfyUI_00001.png'],
      },
    },
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
        description: 'Paste your ComfyUI workflow JSON (API Format). Required field - no built-in templates.',
        placeholder: 'Paste your ComfyUI workflow JSON (API Format) here...\n\n{\n  "3": {\n    "inputs": {\n      "seed": 123456789,\n      ...\n    },\n    "class_type": "KSampler"\n  }\n}',
        hint: 'Required: Export your workflow from ComfyUI in API format and paste it here.',
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
        displayName: 'Load Image Node ID',
        name: 'loadImageNodeId',
        type: 'string',
        default: '',
        description: 'Optional: Node ID of LoadImage node if your workflow uses input images. Leave empty if not using image input.',
        placeholder: 'e.g., 5, 12, load_image_1',
      },
      {
        displayName: 'Image URL',
        name: 'imageUrl',
        type: 'string',
        default: '',
        description: 'Optional: URL of the image to process. Use this when passing images from AI Agents. The node will download and upload the image to ComfyUI.',
        placeholder: 'https://example.com/image.png',
      },
      {
        displayName: 'Parameter Overrides',
        name: 'parameterOverrides',
        type: 'fixedCollection',
        placeholder: 'Add Parameter Override',
        default: {},
        description: 'Override specific node parameters at runtime. Useful for dynamic values from input data.',
        options: [
          {
            displayName: 'Parameter Override',
            name: 'parameterOverride',
            type: 'collection',
            placeholder: 'Add Override',
            default: {},
            options: [
              {
                displayName: 'Image URL',
                name: 'imageUrl',
                type: 'string',
                default: '',
                description: 'URL of the image to download and upload to ComfyUI',
                placeholder: 'https://example.com/image.png',
                displayOptions: {
                  show: {
                    type: ['image'],
                  },
                },
              },
              {
                displayName: 'Node ID',
                name: 'nodeId',
                type: 'string',
                default: '',
                description: 'The node ID to update (e.g., "3", "6", "15")',
                placeholder: 'Node ID from workflow JSON',
              },
              {
                displayName: 'Parameter Path',
                name: 'paramPath',
                type: 'string',
                required: true,
                default: '',
                description: 'Path to the parameter (e.g., "inputs.text", "inputs.seed", "inputs.steps")',
                placeholder: 'inputs.parameter_name',
              },
              {
                displayName: 'Type',
                name: 'type',
                type: 'options',
                default: 'text',
                description: 'Data type of parameter',
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
                    description: 'Image file from URL',
                  },
                ],
              },
              {
                displayName: 'Value',
                name: 'booleanValue',
                type: 'options',
                default: 'false',
                description: 'The boolean value',
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
                    type: ['boolean'],
                  },
                },
              },
              {
                displayName: 'Value',
                name: 'numberValue',
                type: 'number',
                default: 0,
                description: 'The numeric value',
                placeholder: 'Enter number...',
                displayOptions: {
                  show: {
                    type: ['number'],
                  },
                },
              },
              {
                displayName: 'Value',
                name: 'value',
                type: 'string',
                default: '',
                description: 'The text value. Can be a static value or an expression (e.g., "{{ $JSON.prompt }}").',
                placeholder: 'Enter text...',
                displayOptions: {
                  show: {
                    type: ['text'],
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
   * Execute function - called when the node runs
   */
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const logger = createLogger(this.logger);

    // Get node parameters
    const comfyUiUrl = this.getNodeParameter('comfyUiUrl', 0) as string;
    const workflowJson = this.getNodeParameter('workflowJson', 0) as string;
    const timeout = this.getNodeParameter('timeout', 0) as number;
    const loadImageNodeId = this.getNodeParameter('loadImageNodeId', 0) as string;
    const imageUrl = this.getNodeParameter('imageUrl', 0) as string;
    const parameterOverrides = this.getNodeParameter('parameterOverrides', 0) as {
      parameterOverride?: Array<{
        nodeId: string;
        paramPath: string;
        type?: 'text' | 'number' | 'boolean' | 'image';
        value?: string;
        numberValue?: number;
        booleanValue?: string | boolean;
        imageUrl?: string;
      }>;
    };

    // Validate URL
    if (!validateUrl(comfyUiUrl)) {
      throw new NodeOperationError(this.getNode(), 'Invalid ComfyUI URL. Must be a valid HTTP/HTTPS URL.');
    }

    // Parse and validate workflow
    let workflow: Workflow;
    try {
      workflow = parseWorkflow(workflowJson);
      const validation = validateComfyUIWorkflow(workflowJson);
      if (!validation.valid && validation.error) {
        throw new NodeOperationError(this.getNode(), `Invalid workflow: ${validation.error}`);
      }
    } catch (error) {
      if (error instanceof NodeOperationError) {
        throw error;
      }
      throw new NodeOperationError(
        this.getNode(),
        `Failed to parse workflow JSON. Please ensure it is valid ComfyUI API format.\nError: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    logger.info('Processing ComfyUI workflow execution request', { comfyUiUrl, timeout });

    let uploadedImageFilename: string | null = null;

    // Create ComfyUI client
    const client = new ComfyUIClient({
      baseUrl: comfyUiUrl,
      timeout: timeout * 1000,
      helpers: this.helpers,
      logger,
    });

    try {
      // Handle image URL (for AI Agents)
      if (imageUrl && loadImageNodeId) {
        logger.info('Downloading image from URL', { url: imageUrl, nodeId: loadImageNodeId });

        // Validate URL
        const { validateUrl } = await import('../validation');
        if (!validateUrl(imageUrl)) {
          throw new NodeOperationError(
            this.getNode(),
            `Invalid image URL "${imageUrl}". Must be a valid HTTP/HTTPS URL.`
          );
        }

        let buffer: Buffer;
        let filename: string;

        try {
          // Download image using n8n's httpRequest
          const imageResponse = await this.helpers.httpRequest({
            method: 'GET',
            url: imageUrl,
            encoding: 'arraybuffer',
            timeout: timeout * 1000,
          });

          if (!imageResponse || !Buffer.isBuffer(imageResponse)) {
            throw new NodeOperationError(
              this.getNode(),
              `Failed to download image from URL "${imageUrl}". The server did not return valid image data.`
            );
          }

          buffer = Buffer.from(imageResponse);

          if (buffer.length === 0) {
            throw new NodeOperationError(
              this.getNode(),
              `Downloaded image from URL "${imageUrl}" is empty.`
            );
          }

          // Extract filename from URL
          try {
            const urlObj = new URL(imageUrl);
            const pathname = urlObj.pathname;
            filename = pathname.split('/').pop() || 'agent_image.png';

            // Ensure filename has extension
            if (!filename.includes('.')) {
              filename = 'agent_image.png';
            }
          } catch {
            filename = 'agent_image.png';
          }

          logger.info('Successfully downloaded image', {
            url: imageUrl,
            size: buffer.length,
            filename
          });

        } catch (error) {
          if (error instanceof NodeOperationError) {
            throw error;
          }

          const httpError = error as { response?: { statusCode?: number; statusMessage?: string } };
          const statusCode = httpError.response?.statusCode;
          const statusMessage = httpError.response?.statusMessage;

          let errorMessage = `Failed to download image from URL "${imageUrl}"`;
          if (statusCode) {
            errorMessage += ` (HTTP ${statusCode} ${statusMessage || ''})`;
          }

          throw new NodeOperationError(this.getNode(), errorMessage);
        }

        // Upload image to ComfyUI
        uploadedImageFilename = await client.uploadImage(buffer, filename);

        logger.info('Successfully uploaded image to ComfyUI', { filename: uploadedImageFilename });

        // Update workflow with uploaded image filename
        workflow = updateNodeParameter(workflow, loadImageNodeId, 'inputs.image', uploadedImageFilename);
      }

      // Apply parameter overrides if provided
      if (parameterOverrides?.parameterOverride && parameterOverrides.parameterOverride.length > 0) {
        logger.info('Applying parameter overrides', {
          count: parameterOverrides.parameterOverride.length,
        });

        const parameterProcessor = new ParameterProcessor({
          executeFunctions: this,
          logger,
        });

        // Convert simplified parameter overrides to format expected by ParameterProcessor
        const nodeParametersInput = {
          nodeParameter: parameterOverrides.parameterOverride.map((override) => ({
            nodeId: override.nodeId,
            parameterMode: 'single' as const,
            paramName: override.paramPath,
            type: override.type || 'text',
            imageSource: 'url' as const, // ComfyUiTool only supports URL for images
            value: override.value || '',
            numberValue: override.numberValue ?? 0,
            booleanValue: override.booleanValue ?? 'false',
            imageUrl: override.imageUrl || '',
          }))
        };

        await parameterProcessor.processNodeParameters(
          nodeParametersInput,
          workflow,
          (buffer: Buffer, filename: string) => client.uploadImage(buffer, filename),
          timeout
        );
      }

      logger.info('Starting ComfyUI workflow execution');

      // Execute workflow
      const result = await client.executeWorkflow(workflow);

      if (!result.success) {
        logger.error('Workflow execution failed', result.error);
        throw new NodeOperationError(this.getNode(), `Failed to execute workflow: ${result.error}`);
      }

      // Build URLs
      const imageUrls = result.images ? result.images.map(img => `${comfyUiUrl}${img}`) : [];
      const videoUrls = result.videos ? result.videos.map(vid => `${comfyUiUrl}${vid}`) : [];

      const outputJson: JsonData = {
        success: true,
        imageUrls,
        videoUrls,
        imageCount: result.images?.length || 0,
        videoCount: result.videos?.length || 0,
      };

      logger.info('Workflow execution completed successfully', {
        imageCount: outputJson.imageCount,
        videoCount: outputJson.videoCount,
      });

      // Return result (no binary data for AI Agent - URLs only)
      return [this.helpers.constructExecutionMetaData(
        [{ json: outputJson }],
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
