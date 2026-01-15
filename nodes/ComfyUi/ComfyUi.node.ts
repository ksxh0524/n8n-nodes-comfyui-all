import {
  IExecuteFunctions,
  INodeExecutionData,
  NodeOperationError,
} from 'n8n-workflow';

import { ComfyUIClient } from '../ComfyUiClient';
import { validateUrl, validateComfyUIWorkflow, safeJsonParse, validateOutputBinaryKey } from '../validation';
import { NodeParameterInput, Workflow } from '../types';
import { createLogger } from '../logger';
import { ParameterProcessor } from '../parameterProcessor';
import { detectExecutionMode, getDetectionLog } from '../executionModeDetector';

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
    usableAsTool: true, // Enable this node to be used by AI Agents
    inputs: ['main'],
    outputs: ['main'],
    subtitle: 'ComfyUI Integration',
    notes: [
      'Requires a running ComfyUI server',
      'Supports dynamic parameter overrides',
      'Automatically detects execution mode (Tool vs Workflow)',
      'Can be used as a tool by AI Agents',
    ],
    inputSample: {
      comfyUiUrl: 'http://127.0.0.1:8188',
      workflowJson: '{}',
      nodeParameters: [],
      usedAsTool: 'auto',
    },
    outputSample: {
      json: {
        success: true,
        images: [],
        imageUrls: [],
        executionMode: 'auto',
      },
      binary: {
        data: {
          data: 'base64_encoded_image_data',
          mimeType: 'image/png',
          fileName: 'ComfyUI_00001.png',
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
        displayName: 'Workflow JSON',
        name: 'workflowJson',
        type: 'string',
        typeOptions: {
          rows: 20,
        },
        required: true,
        default: '{}',
        description: 'Paste your ComfyUI workflow JSON (API Format). In ComfyUI: 1. Design your workflow 2. Click "Save (API Format)" to export 3. Copy generated JSON 4. Paste it here. Tip: Configure all parameters directly in JSON (prompts, resolution, sampling parameters, frames, etc.).',
        placeholder: 'Paste your ComfyUI workflow JSON...\n\n{\n  "3": {\n    "inputs": {\n      "seed": 123456789,\n      "steps": 20,\n      ...\n    },\n    "class_type": "KSampler"\n  }\n}',
        hint: 'Copy API Format workflow from ComfyUI and paste it here.',
      },
      {
        displayName: 'Timeout',
        name: 'timeout',
        type: 'number',
        default: 300,
        description: 'Maximum time to wait for workflow execution in seconds',
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
        displayName: 'Execution Mode',
        name: 'executionMode',
        type: 'options',
        default: 'auto',
        description: 'Control output format. Tool mode returns URLs only, Action mode returns binary data.',
        options: [
          {
            name: 'Auto Detect',
            value: 'auto',
            description: 'Automatically detect execution mode based on context',
          },
          {
            name: 'Tool Mode',
            value: 'tool',
            description: 'Return URLs only, no binary data. Use with AI Agents.',
          },
          {
            name: 'Action Mode',
            value: 'action',
            description: 'Return full binary data. Use in workflows.',
          },
        ],
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
														name: 'File',
														value: 'file',
														description: 'Image or video file (from binary data or URL)',
													},
													],
												displayOptions: {
													show: {
														parameterMode: ['single'],
													},
												},
											},
											{
												displayName: 'File Input Type',
												name: 'imageSource',
												type: 'options',
												default: 'url',
												description: 'How to input file',
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
														type: ['file'],
													},
												},
											},
											{
												displayName: 'File URL',
												name: 'imageUrl',
												type: 'string',
												default: '',
												description: 'URL of the image or video to download and upload to ComfyUI',
												placeholder: 'https://example.com/file.mp4',
												displayOptions: {
													show: {
														parameterMode: ['single'],
														type: ['file'],
														imageSource: ['url'],
													},
												},
												hint: 'Enter the URL of the file to use',
											},
											{
												displayName: 'Value',
												name: 'value',
												type: 'string',
												typeOptions: {
													rows: 5,
												},
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
														type: ['file'],
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
  async execute(this: IExecuteFunctions & ComfyUi): Promise<INodeExecutionData[][]> {
    const logger = createLogger(this.logger);
    const comfyUiUrl = this.getNodeParameter('comfyUiUrl', 0) as string;
    const workflowJson = this.getNodeParameter('workflowJson', 0) as string;
    const timeout = this.getNodeParameter('timeout', 0) as number;
    const outputBinaryKey = validateOutputBinaryKey(this.getNodeParameter('outputBinaryKey', 0) as string);

    if (!validateUrl(comfyUiUrl)) {
      throw new NodeOperationError(this.getNode(), 'ComfyUI URL format is invalid. Must be a valid HTTP/HTTPS URL.\nNote: Local deployments are supported (e.g., http://localhost:8188, http://127.0.0.1:8188, http://192.168.x.x:8188, etc.).');
    }

    const workflowValidation = validateComfyUIWorkflow(workflowJson);
    if (!workflowValidation.valid) {
      throw new NodeOperationError(this.getNode(), `ComfyUI workflow is invalid: ${workflowValidation.error}. Please ensure the workflow is exported in API format from ComfyUI.`);
    }

    let workflow: Workflow;
    try {
      workflow = safeJsonParse(workflowJson, 'Workflow JSON') as Workflow;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new NodeOperationError(this.getNode(), `Failed to parse workflow JSON: ${errorMsg}. Please ensure the JSON format is correct.`);
    }

    const inputData = this.getInputData();

    // Get user-configured execution mode
    const configuredMode = this.getNodeParameter('executionMode', 0) as 'auto' | 'tool' | 'action';

    let isToolMode: boolean;
    let modeSource: string;

    // Always detect first (for providing suggestions and warnings)
    const detection = detectExecutionMode(inputData, this);

    // Map source to English
    const sourceMap = {
      'n8n-api': 'n8n API',
      'execution-context': 'execution context',
      'input-data': 'input data',
      'heuristics': 'heuristic detection',
      'default': 'default',
    };
    const detectedSource = sourceMap[detection.source] || detection.source;
    const detectedMode = detection.mode;

    // Always show detection results (for reference)
    logger.info('═══════════════════════════════');
    logger.info('📊 Execution Mode Detection Result');
    logger.info('═══════════════════════════════');
    const logInfo = getDetectionLog(detection, inputData);
    logger.info(`🎯 Auto-detection suggestion: ${detectedMode}`);
    logger.info(`   Reason: ${detection.reason}`);
    logger.info(`   Detection source: ${detection.source}`);
    logger.info(`   Confidence: ${detection.confidence === 'high' ? 'high' : detection.confidence === 'medium' ? 'medium' : 'low'}`);
    logger.info(`   Has binary data: ${logInfo.hasBinaryData ? 'yes' : 'no'}`);
    logger.info(`   Has input data: ${logInfo.hasInputData ? 'yes' : 'no'}`);
    logger.info('═══════════════════════════════');

    // Determine execution mode based on configuration
    if (configuredMode === 'tool') {
      // User manually specified Tool mode
      isToolMode = true;
      modeSource = 'user config';

      // If features detected (non-default) and action mode is suggested, issue warning
      if (detectedMode === 'action' && detection.source !== 'default') {
        const confidenceText = detection.confidence === 'high' ? 'high' : detection.confidence === 'medium' ? 'medium' : 'low';
        logger.warn('⚠️  Note: Tool mode manually selected, but auto-detection suggests Action mode');
        logger.warn(`   Detection suggestion: ${detectedMode} mode (source: ${detectedSource}, confidence: ${confidenceText})`);
        logger.warn('   Recommendation: Check if execution mode configuration is correct');
      }
    } else if (configuredMode === 'action') {
      // User manually specified Action mode
      isToolMode = false;
      modeSource = 'user config';

      // If features detected (non-default) and tool mode is suggested, issue warning
      if (detectedMode === 'tool' && detection.source !== 'default') {
        const confidenceText = detection.confidence === 'high' ? 'high' : detection.confidence === 'medium' ? 'medium' : 'low';
        logger.warn('⚠️  Note: Action mode manually selected, but auto-detection suggests Tool mode');
        logger.warn(`   Detection suggestion: ${detectedMode} mode (source: ${detectedSource}, confidence: ${confidenceText})`);
        logger.warn('   Recommendation: Check if execution mode configuration is correct');
      }
    } else {
      // Auto-detect mode - use detection result
      isToolMode = detectedMode === 'tool';
      modeSource = detectedSource;
    }

    logger.info(`📋 Execution mode config: ${configuredMode === 'auto' ? 'auto-detect' : configuredMode === 'tool' ? 'Tool mode' : 'Action mode'}`);
    logger.info(`🔧 Actual execution: ${isToolMode ? 'Tool' : 'Action'} mode (source: ${modeSource})`);

    if (isToolMode) {
      logger.info('⚠️ Tool mode: Only URL image input is supported, Binary input is not supported');
    }

    logger.info(`✅ Final execution: ${isToolMode ? 'tool' : 'action'} mode (source: ${modeSource})`);

    const client = new ComfyUIClient({
      baseUrl: comfyUiUrl,
      timeout: timeout * 1000,
      helpers: this.helpers,
      logger: logger,
    });

    logger.info('Starting ComfyUI workflow execution', {
      url: comfyUiUrl,
      timeout,
      executionMode: isToolMode ? 'Tool' : 'Action',
      modeSource,
    });

    try {
      const parameterProcessor = new ParameterProcessor({
        executeFunctions: this,
        logger,
        isToolMode,
      });

      // Use nodeParameters parameter (both Tool and Action modes use the same configuration method)
      const nodeParametersInput = this.getNodeParameter('nodeParameters', 0) as NodeParameterInput;

      logger.info(`${isToolMode ? 'Tool' : 'Action'} mode: Processing node parameters`, {
        parameterCount: nodeParametersInput?.nodeParameter?.length || 0,
      });

      await parameterProcessor.processNodeParameters({
        nodeParametersInput,
        workflow,
        uploadImage: (buffer: Buffer, filename: string) => client.uploadImage(buffer, filename),
        timeout,
      });

      logger.info('Preparing workflow execution', {
        nodeCount: Object.keys(workflow).length,
        comfyUiUrl,
        workflow: JSON.stringify(workflow, null, 2),
      });

      logger.info('Executing ComfyUI workflow', { nodeCount: Object.keys(workflow).length, comfyUiUrl });
      const result = await client.executeWorkflow(workflow);

      if (!result.success) {
        logger.error('Workflow execution failed', {
          error: result.error,
          errorDetails: result.errorDetails,
          nodeErrors: result.nodeErrors,
        });

        // Construct detailed error message
        let errorMessage = `ComfyUI workflow execution failed: ${result.error}`;

        // Add node error details if available
        if (result.nodeErrors) {
          const nodeErrorMessages: string[] = [];
          for (const [nodeId, nodeError] of Object.entries(result.nodeErrors)) {
            if (nodeError.errors && nodeError.errors.length > 0) {
              const firstError = nodeError.errors[0];
              nodeErrorMessages.push(`Node ${nodeId}: ${firstError.message}${firstError.details ? ` (${firstError.details})` : ''}`);
            }
          }
          if (nodeErrorMessages.length > 0) {
            errorMessage += `\n\nDetails:\n${nodeErrorMessages.join('\n')}`;
          }
        }

        throw new NodeOperationError(this.getNode(), errorMessage);
      }

      let outputData: INodeExecutionData;

      if (isToolMode) {
        logger.info('Tool mode: Returning URLs (no binary data)');
        outputData = {
          json: {
            success: true,
            imageUrls: result.images ? result.images.map(img => `${comfyUiUrl}${img}`) : [],
            videoUrls: result.videos ? result.videos.map(vid => `${comfyUiUrl}${vid}`) : [],
            imageCount: result.images?.length || 0,
            videoCount: result.videos?.length || 0,
          },
        };
      } else {
        logger.info('Action mode: Returning full binary data');
        const { json, binary } = await client.processResults(result, outputBinaryKey);
        outputData = {
          json,
          binary,
        };
      }

      logger.info('Workflow execution succeeded', {
        imageCount: outputData.json.imageCount || 0,
        videoCount: outputData.json.videoCount || 0,
      });

      return [this.helpers.constructExecutionMetaData(
        [outputData],
        { itemData: { item: 0 } }
      )];
    } catch (error: unknown) {
      logger.error('Error during workflow execution', error);
      throw error;
    } finally {
      client.destroy();
      logger.debug('Client destroyed');
    }
  }
}
