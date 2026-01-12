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

interface DetectionResult {
  mode: 'tool' | 'workflow';
  reason: string;
  scores: {
    tool: number;
    workflow: number;
  };
  details: {
    [key: string]: {
      detected: boolean;
      score: number;
      description: string;
    };
  };
}

export class ComfyUi {

  /**
   * Multi-dimensional detection for execution mode (Tool vs Workflow)
   * Uses 5 dimensions to intelligently determine the execution mode
   */
  private detectExecutionMode(
    inputData: INodeExecutionData[],
    workflow: Workflow
  ): DetectionResult {
    const details: DetectionResult['details'] = {};
    let toolScore = 0;
    let workflowScore = 0;

    const hasBinaryData = inputData && inputData.length > 0 &&
                       inputData[0].binary &&
                       Object.keys(inputData[0].binary).length > 0;
    details['binaryData'] = {
      detected: !!hasBinaryData,
      score: hasBinaryData ? 0 : 3,
      description: hasBinaryData ? '输入包含二进制数据' : '输入不包含二进制数据',
    };
    if (hasBinaryData) workflowScore += 3;

    let hasSimpleStructure = false;
    let hasComplexStructure = false;
    if (inputData && inputData.length > 0 && inputData[0].json) {
      const json = inputData[0].json;
      const keys = Object.keys(json);

      const toolFields = ['prompt', 'imageUrl', 'text', 'description', 'query', 'message'];
      const hasToolFields = toolFields.some(f => f in json);

      const hasNestedObject = keys.some(k =>
        typeof json[k] === 'object' && json[k] !== null && !Array.isArray(json[k])
      );
      const hasArrayData = keys.some(k => Array.isArray(json[k]));

      hasSimpleStructure = hasToolFields && !hasNestedObject && !hasArrayData;
      hasComplexStructure = hasNestedObject || hasArrayData;
    }

    details['dataStructure'] = {
      detected: hasSimpleStructure,
      score: hasSimpleStructure ? 2 : (hasComplexStructure ? 0 : 0),
      description: hasSimpleStructure ? '简单数据结构（Tool 模式特征）' :
                  hasComplexStructure ? '复杂数据结构（Workflow 模式特征）' :
                  '无法判断数据结构',
    };
    if (hasSimpleStructure) toolScore += 2;
    if (hasComplexStructure) workflowScore += 0;

    let hasSimpleValues = false;
    if (inputData && inputData.length > 0 && inputData[0].json) {
      const json = inputData[0].json;
      const values = Object.values(json);
      const allSimple = values.every(v =>
        typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
      );
      hasSimpleValues = allSimple && values.length > 0;
    }

    details['fieldTypes'] = {
      detected: hasSimpleValues,
      score: hasSimpleValues ? 1 : 0,
      description: hasSimpleValues ? '字段值都是简单类型（Tool 模式特征）' : '字段值包含复杂类型',
    };
    if (hasSimpleValues) toolScore += 1;

    let fromAiAgent = false;
    if (inputData && inputData.length > 0 && inputData[0].json) {
      const json = inputData[0].json;
      fromAiAgent = 'aiAgentContext' in json ||
                   'conversationId' in json ||
                   'toolCallId' in json ||
                   'isToolCall' in json;
    }

    details['dataSource'] = {
      detected: fromAiAgent,
      score: fromAiAgent ? 2 : 0,
      description: fromAiAgent ? '检测到 AI Agent 元数据' : '未检测到 AI Agent 元数据',
    };
    if (fromAiAgent) toolScore += 2;

    let hasLoadImageNode = false;
    for (const nodeId in workflow) {
      const node = workflow[nodeId];
      if (node.class_type === 'LoadImage' ||
          node.class_type === 'LoadImageBatch' ||
          node.class_type === 'LoadImageMask') {
        hasLoadImageNode = true;
        break;
      }
    }

    details['workflowConfig'] = {
      detected: hasLoadImageNode,
      score: hasLoadImageNode ? 1 : 1,
      description: hasLoadImageNode ? '工作流包含 LoadImage 节点（两种模式都可能）' : '工作流不包含 LoadImage 节点',
    };

    let mode: 'tool' | 'workflow';
    let reason: string;

    if (toolScore >= 3) {
      mode = 'tool';
      reason = `Tool 分数 (${toolScore}) >= 阈值 (3)`;
    } else if (workflowScore >= 3) {
      mode = 'workflow';
      reason = `Workflow 分数 (${workflowScore}) >= 阈值 (3)`;
    } else {
      mode = 'workflow';
      reason = `默认 Workflow 模式（更安全，Tool 分数: ${toolScore}, Workflow 分数: ${workflowScore}）`;
    }

    const result: DetectionResult = {
      mode,
      reason,
      scores: { tool: toolScore, workflow: workflowScore },
      details,
    };

    return result;
  }

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

    // 自动检测执行模式
    const detection = this.detectExecutionMode(inputData, workflow);
    isToolMode = detection.mode === 'tool';
    modeSource = '自动检测';

    // 输出执行模式信息
    logger.info('═══════════════════════════════');
    logger.info('📊 执行模式检测结果');
    logger.info('═══════════════════════════════');
    logger.info('🎯 最终决策', {
      mode: detection.mode,
      reason: detection.reason,
    });
    logger.info('📈 分数统计', {
      tool: detection.scores.tool,
      action: detection.scores.workflow,
      total: detection.scores.tool + detection.scores.workflow,
    });
    logger.info('🔍 各维度详情');
    for (const [key, detail] of Object.entries(detection.details) as [string, DetectionResult['details'][string]][]) {
      const icon = detail.detected ? '✅' : '❌';
      logger.info(`  ${icon} ${key}:`, {
        detected: detail.detected,
        score: detail.score,
        description: detail.description,
      });
    }
    logger.info('═══════════════════════════════');

    if (isToolMode) {
      logger.info('⚠️ Tool 模式限制', {
        message: '当前为 Tool 模式，只支持 URL 图片输入，不支持 Binary 输入',
        recommendation: '如需使用 Binary 输入，请在工作流中传入二进制数据',
      });
    }

    logger.info('✅ 最终执行', {
      mode: detection.mode,
      using: '按自动检测结果执行 (' + detection.mode + ' 模式)',
    });

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

      await parameterProcessor.processNodeParameters(
        nodeParametersInput,
        workflow,
        (buffer: Buffer, filename: string) => client.uploadImage(buffer, filename),
        timeout
      );

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
