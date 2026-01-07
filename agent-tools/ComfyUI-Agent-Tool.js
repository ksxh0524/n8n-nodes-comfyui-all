/**
 * ComfyUI Agent Tool - Custom Code Tool for n8n AI Agent
 *
 * 这个工具允许 AI Agent 直接调用 ComfyUI API 生成图像
 *
 * 使用方法：
 * 1. 在 n8n 中创建一个 "Custom Code Tool" 节点
 * 2. 将此代码复制到 JavaScript 代码框中
 * 3. 在 Description 中填写：Generates images using ComfyUI. Use this tool when the user asks to create, generate, or make images.
 * 4. 将此工具添加到 AI Agent 节点的 tools 列表中
 */

// 默认配置
const DEFAULT_COMFYUI_URL = 'http://127.0.0.1:8188';

// 参数提取规则配置
const PARAM_PATTERNS = {
  negative: {
    regex: /negative:\s*([^\n]+)/i,
    paramKey: 'negative_prompt',
    parser: (match) => match[1].trim()
  },
  size: {
    regex: /size:\s*(\d+)x(\d+)/i,
    paramKeys: ['width', 'height'],
    parser: (match) => ({
      width: parseInt(match[1]),
      height: parseInt(match[2])
    })
  },
  steps: {
    regex: /steps:\s*(\d+)/i,
    paramKey: 'steps',
    parser: (match) => parseInt(match[1])
  },
  cfg: {
    regex: /cfg:\s*([\d.]+)/i,
    paramKey: 'cfg',
    parser: (match) => parseFloat(match[1])
  },
  seed: {
    regex: /seed:\s*(\d+)/i,
    paramKey: 'seed',
    parser: (match) => parseInt(match[1])
  }
};

// 示例工作流模板（文本生成图像）
// 你可以从 ComfyUI 导出你自己的工作流并替换这个模板
const WORKFLOW_TEMPLATE = {
  "3": {
    "inputs": {
      "seed": 0,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    },
    "class_type": "KSampler"
  },
  "4": {
    "inputs": {
      "ckpt_name": "v1-5-pruned-emaonly.ckpt"
    },
    "class_type": "CheckpointLoaderSimple"
  },
  "5": {
    "inputs": {
      "width": 512,
      "height": 512,
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage"
  },
  "6": {
    "inputs": {
      "text": "",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "7": {
    "inputs": {
      "text": "ugly, blurry, low quality",
      "clip": ["4", 1]
    },
    "class_type": "CLIPTextEncode"
  },
  "8": {
    "inputs": {
      "samples": ["3", 0],
      "vae": ["4", 2]
    },
    "class_type": "VAEDecode"
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": ["8", 0]
    },
    "class_type": "SaveImage"
  }
};

/**
 * 从查询中提取参数
 * @param {string} query - 用户查询文本
 * @param {Object} pattern - 参数模式配置
 * @returns {Object} 提取的参数和清理后的查询
 */
function extractParameter(query, pattern) {
  const match = query.match(pattern.regex);
  if (!match) {
    return { value: null, cleanedQuery: query };
  }

  const value = pattern.parser(match);
  const cleanedQuery = query.replace(pattern.regex, '').trim();

  return { value, cleanedQuery };
}

/**
 * 解析用户输入，提取图像生成参数
 * @param {string} query - 用户查询文本
 * @returns {Object} 解析后的参数对象
 */
function parseInput(query) {
  const params = {
    prompt: '',
    negative_prompt: 'ugly, blurry, low quality, distorted',
    width: 512,
    height: 512,
    steps: 20,
    cfg: 8,
    seed: Math.floor(Math.random() * 2147483647)
  };

  let currentQuery = query.trim();

  for (const [paramName, pattern] of Object.entries(PARAM_PATTERNS)) {
    const { value, cleanedQuery } = extractParameter(currentQuery, pattern);

    if (value !== null) {
      if (pattern.paramKeys) {
        pattern.paramKeys.forEach((key, index) => {
          params[key] = value[Object.keys(value)[index]];
        });
      } else {
        params[pattern.paramKey] = value;
      }
      currentQuery = cleanedQuery;
    }
  }

  // 清理剩余的参数标记和多余的标点
  currentQuery = currentQuery
    .replace(/，\s*，/g, '，') // 移除连续的中文逗号
    .replace(/,\s*,/g, ',') // 移除连续的英文逗号
    .replace(/[，,]\s*$/g, '') // 移除末尾的中文或英文逗号
    .replace(/^\s*[，,]\s*/g, '') // 移除开头的中文或英文逗号
    .replace(/[，,]\s*[，,]/g, ' ') // 移除逗号之间的多余空格
    .replace(/[，,]\s*$/g, '') // 再次移除末尾的逗号
    .replace(/^\s*[，,]+/g, '') // 移除开头的所有逗号
    .replace(/[，,]+\s*$/g, '') // 移除末尾的所有逗号
    .trim();
  params.prompt = currentQuery;

  return params;
}

/**
 * 根据节点类型查找节点 ID
 * @param {Object} workflow - 工作流对象
 * @param {string} classType - 节点类型
 * @returns {string|null} 节点 ID 或 null
 */
function findNodeByClassType(workflow, classType) {
  for (const nodeId in workflow) {
    if (workflow[nodeId] && workflow[nodeId].class_type === classType) {
      return nodeId;
    }
  }
  return null;
}

/**
 * 更新工作流参数
 * @param {Object} workflow - ComfyUI 工作流对象
 * @param {Object} params - 参数对象
 * @returns {Object} 更新后的工作流
 */
function updateWorkflow(workflow, params) {
  const updatedWorkflow = JSON.parse(JSON.stringify(workflow));

  // 查找并更新正向和负向提示词节点
  const clipTextEncodeNodes = [];
  for (const nodeId in updatedWorkflow) {
    if (updatedWorkflow[nodeId] && updatedWorkflow[nodeId].class_type === 'CLIPTextEncode') {
      clipTextEncodeNodes.push(nodeId);
    }
  }

  if (clipTextEncodeNodes.length >= 1) {
    updatedWorkflow[clipTextEncodeNodes[0]].inputs.text = params.prompt;
  }
  if (clipTextEncodeNodes.length >= 2) {
    updatedWorkflow[clipTextEncodeNodes[1]].inputs.text = params.negative_prompt;
  }

  // 查找并更新图像尺寸节点
  const latentNodeId = findNodeByClassType(updatedWorkflow, 'EmptyLatentImage') ||
                      findNodeByClassType(updatedWorkflow, 'EmptySD3LatentImage');
  if (latentNodeId && updatedWorkflow[latentNodeId].inputs) {
    updatedWorkflow[latentNodeId].inputs.width = params.width;
    updatedWorkflow[latentNodeId].inputs.height = params.height;
  }

  // 查找并更新采样参数节点
  const samplerNodeId = findNodeByClassType(updatedWorkflow, 'KSampler');
  if (samplerNodeId && updatedWorkflow[samplerNodeId].inputs) {
    updatedWorkflow[samplerNodeId].inputs.steps = params.steps;
    updatedWorkflow[samplerNodeId].inputs.cfg = params.cfg;
    updatedWorkflow[samplerNodeId].inputs.seed = params.seed;
  }

  // 查找并更新编辑指令节点（用于图片编辑工作流）
  const primitiveNodeId = findNodeByClassType(updatedWorkflow, 'PrimitiveStringMultiline');
  if (primitiveNodeId && updatedWorkflow[primitiveNodeId].inputs) {
    updatedWorkflow[primitiveNodeId].inputs.value = params.prompt;
  }

  return updatedWorkflow;
}

/**
 * 从输出节点中提取图像信息
 * @param {Object} outputs - ComfyUI 输出对象
 * @param {string} url - ComfyUI 服务器 URL
 * @returns {Array} 图像信息数组
 */
function extractImagesFromOutputs(outputs, url) {
  const images = [];

  for (const nodeId in outputs) {
    if (!outputs[nodeId] || !outputs[nodeId].images) {
      continue;
    }

    const nodeImages = outputs[nodeId].images;

    if (!Array.isArray(nodeImages) || nodeImages.length === 0) {
      continue;
    }

    for (const image of nodeImages) {
      const imageInfo = processImage(image, nodeId, url);
      if (imageInfo) {
        images.push(imageInfo);
      }
    }
  }

  return images;
}

/**
 * 处理单个图像对象
 * @param {Object} image - 图像对象
 * @param {string} nodeId - 节点 ID
 * @param {string} url - ComfyUI 服务器 URL
 * @returns {Object|null} 处理后的图像信息或 null
 */
function processImage(image, nodeId, url) {
  if (!image || typeof image !== 'object') {
    console.warn(`[ComfyUI Tool] Invalid image object in node ${nodeId}`);
    return null;
  }

  const filename = image.filename;
  const subfolder = image.subfolder || '';
  const type = image.type || 'output';

  if (!filename) {
    console.warn(`[ComfyUI Tool] Image missing filename in node ${nodeId}`);
    return null;
  }

  return {
    filename: filename,
    subfolder: subfolder,
    type: type,
    url: `${url}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`
  };
}

/**
 * 执行 ComfyUI 工作流
 * @param {Object} workflow - ComfyUI 工作流对象
 * @param {string} comfyUiUrl - ComfyUI 服务器 URL
 */
async function executeComfyUIWorkflow(workflow, comfyUiUrl) {
  const axios = require('axios');

  const url = comfyUiUrl || DEFAULT_COMFYUI_URL;

  // 1. 队列提示词
  let promptResponse;
  try {
    promptResponse = await axios.post(`${url}/prompt`, {
      prompt: workflow
    }, {
      timeout: 30000 // 30秒超时
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Failed to connect to ComfyUI server at ${url}. Please check if the server is running.`);
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`Connection timeout while connecting to ComfyUI server at ${url}.`);
    } else if (error.response) {
      throw new Error(`ComfyUI server returned error: ${error.response.status} ${error.response.statusText}`);
    } else {
      throw new Error(`Failed to queue workflow: ${error.message}`);
    }
  }

  if (!promptResponse.data || !promptResponse.data.prompt_id) {
    throw new Error('Invalid response from ComfyUI server: missing prompt_id');
  }

  const promptId = promptResponse.data.prompt_id;
  console.log(`[ComfyUI Tool] Workflow queued with ID: ${promptId}`);

  // 2. 轮询结果
  let attempts = 0;
  const maxAttempts = 120; // 最多等待 2 分钟

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 检查历史记录
    let historyResponse;
    try {
      historyResponse = await axios.get(`${url}/history/${promptId}`, {
        timeout: 10000 // 10秒超时
      });
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Lost connection to ComfyUI server at ${url}.`);
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.warn(`[ComfyUI Tool] Timeout checking history (attempt ${attempts + 1}/${maxAttempts})`);
        attempts++;
        continue;
      } else {
        console.warn(`[ComfyUI Tool] Error checking history: ${error.message}`);
        attempts++;
        continue;
      }
    }

    if (historyResponse.data && historyResponse.data[promptId]) {
      const outputs = historyResponse.data[promptId].outputs;

      if (outputs) {
        const images = extractImagesFromOutputs(outputs, url);

        if (images.length === 0) {
          throw new Error('Workflow completed but no images were generated');
        }

        return {
          success: true,
          prompt_id: promptId,
          images: images
        };
      }
    }

    attempts++;
  }

  throw new Error(`Workflow execution timeout after ${maxAttempts} seconds (prompt_id: ${promptId}). The workflow may still be running on the ComfyUI server.`);
}

/**
 * 主函数：处理工具调用
 * @param {string} query - 用户查询文本
 * @param {Object} options - 可选配置参数
 * @param {string} options.comfyUiUrl - ComfyUI 服务器 URL
 */
async function handleToolInput(query, options = {}) {
  try {
    const { comfyUiUrl } = options;
    console.log(`[ComfyUI Tool] Received query: ${query}`);
    if (comfyUiUrl) {
      console.log(`[ComfyUI Tool] Using ComfyUI URL: ${comfyUiUrl}`);
    }

    // 解析输入参数
    const params = parseInput(query);
    console.log('[ComfyUI Tool] Parsed parameters:', JSON.stringify(params, null, 2));

    // 更新工作流
    const workflow = updateWorkflow(WORKFLOW_TEMPLATE, params);

    // 执行工作流
    const result = await executeComfyUIWorkflow(workflow, comfyUiUrl);

    console.log(`[ComfyUI Tool] Generated ${result.images.length} image(s)`);

    // 返回结果
    return {
      success: true,
      message: `Successfully generated ${result.images.length} image(s) with prompt: "${params.prompt}"`,
      data: {
        prompt: params.prompt,
        images: result.images.map(img => img.url),
        parameters: params
      }
    };

  } catch (error) {
    console.error('[ComfyUI Tool] Error:', error.message);

    return {
      success: false,
      error: error.message,
      message: `Failed to generate image: ${error.message}`
    };
  }
}

// ==================== n8n 集成 ====================
// 在 n8n Custom Code Tool 中，使用下面的代码：

// for (const item of items) {
//   const query = item.json.query || item.json.text || '';
//   const comfyUiUrl = item.json.comfyUiUrl || 'http://127.0.0.1:8188';
//   const result = await handleToolInput(query, { comfyUiUrl });
//   return result;
// }

// 导出供测试使用
module.exports = { handleToolInput, parseInput, updateWorkflow };
