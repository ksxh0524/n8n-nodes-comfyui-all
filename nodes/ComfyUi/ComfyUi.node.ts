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
												description: 'How to input image',
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
  async execute(this: IExecuteFunctions & ComfyUi): Promise<INodeExecutionData[][]> {
    const logger = createLogger(this.logger);
    const comfyUiUrl = this.getNodeParameter('comfyUiUrl', 0) as string;
    const workflowJson = this.getNodeParameter('workflowJson', 0) as string;
    const timeout = this.getNodeParameter('timeout', 0) as number;
    const outputBinaryKey = validateOutputBinaryKey(this.getNodeParameter('outputBinaryKey', 0) as string);

    if (!validateUrl(comfyUiUrl)) {
      throw new NodeOperationError(this.getNode(), 'ComfyUI URL 格式无效。必须是有效的 HTTP/HTTPS URL。\n提示：支持本地部署地址（如 http://localhost:8188、http://127.0.0.1:8188、http://192.168.x.x:8188 等）。');
    }

    const workflowValidation = validateComfyUIWorkflow(workflowJson);
    if (!workflowValidation.valid) {
      throw new NodeOperationError(this.getNode(), `ComfyUI 工作流无效：${workflowValidation.error}。请确保从 ComfyUI 导出 API 格式的工作流。`);
    }

    let workflow: Workflow;
    try {
      workflow = safeJsonParse(workflowJson, 'Workflow JSON') as Workflow;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new NodeOperationError(this.getNode(), `解析工作流 JSON 失败：${errorMsg}。请确保 JSON 格式正确。`);
    }

    const inputData = this.getInputData();


    let isToolMode: boolean;
    let modeSource: string;

    // 简化版执行模式检测（带 context 备用机制）
    const detection = detectExecutionMode(inputData, (this as { context?: unknown }).context);
    isToolMode = detection.mode === 'tool';
    modeSource = detection.source === 'context' ? 'n8n上下文' : detection.source === 'input-data' ? '输入数据' : '默认';

    // 简化的日志输出
    logger.info('═══════════════════════════════');
    logger.info('📊 执行模式检测结果');
    logger.info('═══════════════════════════════');
    const logInfo = getDetectionLog(detection, inputData);
    logger.info(`🎯 最终决策: ${detection.mode}`);
    logger.info(`   原因: ${detection.reason}`);
    logger.info(`   检测来源: ${detection.source}`);
    logger.info(`   有二进制数据: ${logInfo.hasBinaryData ? '是' : '否'}`);
    logger.info(`   有输入数据: ${logInfo.hasInputData ? '是' : '否'}`);
    logger.info('═══════════════════════════════');

    if (isToolMode) {
      logger.info('⚠️ Tool 模式: 只支持 URL 图片输入，不支持 Binary 输入');
    }

    logger.info(`✅ 最终执行: ${detection.mode} 模式 (按自动检测结果)`);

    const client = new ComfyUIClient({
      baseUrl: comfyUiUrl,
      timeout: timeout * 1000,
      helpers: this.helpers,
      logger: logger,
    });

    logger.info('开始执行 ComfyUI 工作流', {
      url: comfyUiUrl,
      timeout,
      executionMode: isToolMode ? 'Tool' : 'Action',
      modeSource,
    });

    try {
      const nodeParametersInput = this.getNodeParameter('nodeParameters', 0) as NodeParameterInput;
      const parameterProcessor = new ParameterProcessor({
        executeFunctions: this,
        logger,
        isToolMode,
      });

      // Use configuration object instead of multiple parameters
      await parameterProcessor.processNodeParameters({
        nodeParametersInput,
        workflow,
        uploadImage: (buffer: Buffer, filename: string) => client.uploadImage(buffer, filename),
        timeout,
      });

      logger.info('准备执行工作流', {
        nodeCount: Object.keys(workflow).length,
        comfyUiUrl,
        workflow: JSON.stringify(workflow, null, 2),
      });

      logger.info('正在执行 ComfyUI 工作流', { nodeCount: Object.keys(workflow).length, comfyUiUrl });
      const result = await client.executeWorkflow(workflow);

      if (!result.success) {
        logger.error('工作流执行失败', result.error);
        throw new NodeOperationError(this.getNode(), `Failed to execute workflow: ${result.error}`);
      }

      let outputData: INodeExecutionData;

      if (isToolMode) {
        logger.info('Tool 模式：返回 URL（不包含二进制数据）');
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
        logger.info('Action 模式：返回完整二进制数据');
        const { json, binary } = await client.processResults(result, outputBinaryKey);
        outputData = {
          json,
          binary,
        };
      }

      logger.info('工作流执行成功', {
        imageCount: outputData.json.imageCount || 0,
        videoCount: outputData.json.videoCount || 0,
      });

      return [this.helpers.constructExecutionMetaData(
        [outputData],
        { itemData: { item: 0 } }
      )];
    } catch (error) {
      logger.error('工作流执行期间出错', error);
      throw error;
    } finally {
      client.destroy();
      logger.debug('客户端已销毁');
    }
  }
}
