/**
 * ComfyUI Tool - AI Agent-friendly image generation node
 *
 * This node is designed to be used as an AI Agent tool with minimal configuration.
 * It accepts a simple text query and automatically generates images using ComfyUI.
 * Supports both Text-to-Image and Image-to-Image workflows.
 */

import {
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';

import { ComfyUIClient } from '../ComfyUiClient';
import { validateUrl, safeJsonParse } from '../validation';
import { Workflow, JsonData } from '../types';
import { createLogger } from '../logger';
import {
  parseInput,
  updateWorkflow,
  updateWorkflowWithImage,
  hasBinaryData,
  getFirstBinaryKey,
  extractBinaryData,
} from '../agentToolHelpers';
import { getWorkflowTemplate } from '../workflowConfig';

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
    description: 'AI-friendly image generation tool. Supports text-to-image and image-to-image.',
    defaults: {
      name: 'ComfyUI Tool',
    },
    usableAsTool: true,
    inputs: ['main'],
    outputs: ['main'],
    subtitle: 'AI Image Generator',
    notes: [
      'Optimized for AI Agent usage',
      'Automatically detects and handles both text-to-image and image-to-image',
      'For image editing: pass image binary + text description',
      'Supports size, steps, cfg, seed, and negative prompt parameters',
      'Examples: "A beautiful sunset, size:1024x768, steps:30"',
    ],
    inputSample: {
      query: 'A beautiful landscape painting',
    },
    outputSample: {
      json: {
        success: true,
        imageCount: 1,
        imageUrls: ['http://127.0.0.1:8188/view?filename=ComfyUI_00001.png'],
        prompt: 'A beautiful landscape painting',
        mode: 'text-to-image',
        parameters: {
          width: 512,
          height: 512,
          steps: 20,
          cfg: 8,
          seed: 123456789,
        },
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
        displayName: 'Timeout (Seconds)',
        name: 'timeout',
        type: 'number',
        default: 120,
        description: 'Maximum time to wait for image generation (in seconds). Default: 120 (2 minutes).',
        minValue: 10,
        maxValue: 600,
      },
      {
        displayName: 'Default Negative Prompt',
        name: 'defaultNegativePrompt',
        type: 'string',
        default: 'ugly, blurry, low quality, distorted',
        description: 'Default negative prompt to use when not specified in query',
        placeholder: 'ugly, blurry, low quality',
      },
      {
        displayName: 'Advanced Options',
        name: 'advancedOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Custom Workflow JSON',
            name: 'customWorkflow',
            type: 'string',
            typeOptions: {
              rows: 20,
            },
            default: '',
            description: 'Optional: Custom ComfyUI workflow JSON (API Format). If empty, uses default workflow. Only use this if you want to override the default template.',
          },
          {
            displayName: 'Default CFG',
            name: 'defaultCfg',
            type: 'number',
            default: 8,
            description: 'Default CFG scale when not specified in query',
            minValue: 1,
            maxValue: 30,
          },
          {
            displayName: 'Default Height',
            name: 'defaultHeight',
            type: 'number',
            default: 512,
            description: 'Default image height when not specified in query',
            minValue: 64,
            maxValue: 4096,
          },
          {
            displayName: 'Default Steps',
            name: 'defaultSteps',
            type: 'number',
            default: 20,
            description: 'Default sampling steps when not specified in query',
            minValue: 1,
            maxValue: 150,
          },
          {
            displayName: 'Default Width',
            name: 'defaultWidth',
            type: 'number',
            default: 512,
            description: 'Default image width when not specified in query',
            minValue: 64,
            maxValue: 4096,
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
    const timeout = this.getNodeParameter('timeout', 0) as number;
    const defaultNegativePrompt = this.getNodeParameter('defaultNegativePrompt', 0) as string;

    const advancedOptions = this.getNodeParameter('advancedOptions', 0) as {
      customWorkflow?: string;
      defaultWidth?: number;
      defaultHeight?: number;
      defaultSteps?: number;
      defaultCfg?: number;
    };

    const {
      customWorkflow = '',
      defaultWidth = 512,
      defaultHeight = 512,
      defaultSteps = 20,
      defaultCfg = 8,
    } = advancedOptions || {};

    // Validate URL
    if (!validateUrl(comfyUiUrl)) {
      throw new NodeOperationError(this.getNode(), 'Invalid ComfyUI URL. Must be a valid HTTP/HTTPS URL.');
    }

    // Get input data
    const inputData = this.getInputData();

    if (!inputData || inputData.length === 0) {
      throw new NodeOperationError(this.getNode(), 'No input data provided. Please provide a query text.');
    }

    // Check if input contains binary image data
    const hasInputImage = hasBinaryData(inputData);
    let uploadedImageFilename: string | null = null;

    // Get query from input
    const firstItem = inputData[0];
    const query = (firstItem.json.query as string) ||
                  (firstItem.json.text as string) ||
                  (firstItem.json.prompt as string) ||
                  '';

    if (!query || query.trim().length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'No query found in input. Please provide a "query", "text", or "prompt" field with a description of the image you want to generate.'
      );
    }

    // Determine mode based on input
    const mode = hasInputImage ? 'image-to-image' : 'text-to-image';

    logger.info('Processing image generation request', { query, comfyUiUrl, timeout, mode });

    // Parse the query to extract parameters
    const params = parseInput(query, {
      negativePrompt: defaultNegativePrompt,
      width: defaultWidth,
      height: defaultHeight,
      steps: defaultSteps,
      cfg: defaultCfg,
    });

    logger.debug('Parsed parameters', {
      prompt: params.prompt,
      width: params.width,
      height: params.height,
      steps: params.steps,
      cfg: params.cfg,
      seed: params.seed,
    });

    // Get workflow template
    let workflowTemplate: Workflow;
    if (customWorkflow && customWorkflow.trim().length > 0) {
      workflowTemplate = safeJsonParse(customWorkflow, 'Custom workflow JSON') as Workflow;
    } else {
      workflowTemplate = getWorkflowTemplate({ mode });
    }

    // Create ComfyUI client
    const client = new ComfyUIClient({
      baseUrl: comfyUiUrl,
      timeout: timeout * 1000,
      helpers: this.helpers,
      logger,
    });

    try {
      logger.info('Starting ComfyUI workflow execution');

      // If input contains image, upload it first
      if (hasInputImage) {
        const binaryKey = getFirstBinaryKey(inputData);
        if (!binaryKey) {
          throw new NodeOperationError(this.getNode(), 'Binary data found but no binary key detected.');
        }

        const binaryData = extractBinaryData(inputData, binaryKey);
        if (!binaryData) {
          throw new NodeOperationError(this.getNode(), `Failed to extract binary data from key "${binaryKey}".`);
        }

        logger.info('Uploading input image to ComfyUI', {
          fileName: binaryData.fileName,
          mimeType: binaryData.mimeType,
        });

        // Convert base64 to buffer
        const buffer = Buffer.from(binaryData.data, 'base64');

        // Upload image to ComfyUI
        uploadedImageFilename = await client.uploadImage(buffer, binaryData.fileName || 'input_image.png');

        logger.info('Successfully uploaded input image', { filename: uploadedImageFilename });
      }

      // Update workflow with parsed parameters
      let workflow = updateWorkflow(workflowTemplate, params);

      // If we uploaded an image, update workflow with the image filename
      if (uploadedImageFilename) {
        workflow = updateWorkflowWithImage(workflow, uploadedImageFilename);
      }

      // Execute workflow
      const result = await client.executeWorkflow(workflow);

      if (!result.success) {
        logger.error('Workflow execution failed', result.error);
        throw new NodeOperationError(this.getNode(), `Failed to generate image: ${result.error}`);
      }

      // Only return URLs without downloading (for AI Agent)
      const imageUrls = result.images ? result.images.map(img => `${comfyUiUrl}${img}`) : [];
      const videoUrls = result.videos ? result.videos.map(vid => `${comfyUiUrl}${vid}`) : [];

      const enhancedJson: JsonData = {
        success: true,
        imageUrls,
        videoUrls,
        imageCount: result.images?.length || 0,
        videoCount: result.videos?.length || 0,
        prompt: params.prompt,
        mode: mode,
        parameters: {
          width: params.width,
          height: params.height,
          steps: params.steps,
          cfg: params.cfg,
          seed: params.seed,
          negative_prompt: params.negative_prompt,
        },
      } as JsonData;

      logger.info('Image generation completed successfully', {
        imageCount: enhancedJson.imageCount,
        mode,
      });

      // Return result (no binary data for AI Agent)
      return [this.helpers.constructExecutionMetaData(
        [{ json: enhancedJson }],
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
