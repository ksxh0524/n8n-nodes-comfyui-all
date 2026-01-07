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

// 配置
const COMFYUI_URL = 'http://127.0.0.1:8188';

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
 * 解析用户输入，提取图像生成参数
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

  // 提取正向提示词（整个 query）
  params.prompt = query.trim();

  // 提取负向提示词
  const negativeMatch = query.match(/negative:\s*([^\n]+)/i);
  if (negativeMatch) {
    params.negative_prompt = negativeMatch[1].trim();
    params.prompt = params.prompt.replace(/negative:\s*[^\n]+/i, '').trim();
  }

  // 提取尺寸
  const sizeMatch = query.match(/size:\s*(\d+)x(\d+)/i);
  if (sizeMatch) {
    params.width = parseInt(sizeMatch[1]);
    params.height = parseInt(sizeMatch[2]);
    params.prompt = params.prompt.replace(/size:\s*\d+x\d+/i, '').trim();
  }

  // 提取步数
  const stepsMatch = query.match(/steps:\s*(\d+)/i);
  if (stepsMatch) {
    params.steps = parseInt(stepsMatch[1]);
    params.prompt = params.prompt.replace(/steps:\s*\d+/i, '').trim();
  }

  // 提取 CFG
  const cfgMatch = query.match(/cfg:\s*([\d.]+)/i);
  if (cfgMatch) {
    params.cfg = parseFloat(cfgMatch[1]);
    params.prompt = params.prompt.replace(/cfg:\s*[\d.]+/i, '').trim();
  }

  // 提取种子
  const seedMatch = query.match(/seed:\s*(\d+)/i);
  if (seedMatch) {
    params.seed = parseInt(seedMatch[1]);
    params.prompt = params.prompt.replace(/seed:\s*\d+/i, '').trim();
  }

  return params;
}

/**
 * 更新工作流参数
 */
function updateWorkflow(workflow, params) {
  const updatedWorkflow = JSON.parse(JSON.stringify(workflow));

  // 更新正向提示词
  updatedWorkflow["6"].inputs.text = params.prompt;

  // 更新负向提示词
  updatedWorkflow["7"].inputs.text = params.negative_prompt;

  // 更新图像尺寸
  updatedWorkflow["5"].inputs.width = params.width;
  updatedWorkflow["5"].inputs.height = params.height;

  // 更新采样参数
  updatedWorkflow["3"].inputs.steps = params.steps;
  updatedWorkflow["3"].inputs.cfg = params.cfg;
  updatedWorkflow["3"].inputs.seed = params.seed;

  return updatedWorkflow;
}

/**
 * 执行 ComfyUI 工作流
 */
async function executeComfyUIWorkflow(workflow) {
  const axios = require('axios');

  // 1. 队列提示词
  const promptResponse = await axios.post(`${COMFYUI_URL}/prompt`, {
    prompt: workflow
  });

  const promptId = promptResponse.data.prompt_id;
  console.log(`[ComfyUI Tool] Workflow queued with ID: ${promptId}`);

  // 2. 轮询结果
  let attempts = 0;
  const maxAttempts = 120; // 最多等待 2 分钟

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 检查历史记录
    const historyResponse = await axios.get(`${COMFYUI_URL}/history/${promptId}`);

    if (historyResponse.data[promptId]) {
      const outputs = historyResponse.data[promptId].outputs;

      // 提取生成的图像
      if (outputs) {
        const images = [];

        for (const nodeId in outputs) {
          if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
            for (const image of outputs[nodeId].images) {
              images.push({
                filename: image.filename,
                subfolder: image.subfolder,
                type: image.type,
                url: `${COMFYUI_URL}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`
              });
            }
          }
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

  throw new Error('Workflow execution timeout');
}

/**
 * 主函数：处理工具调用
 */
async function handleToolInput(query) {
  try {
    console.log(`[ComfyUI Tool] Received query: ${query}`);

    // 解析输入参数
    const params = parseInput(query);
    console.log('[ComfyUI Tool] Parsed parameters:', JSON.stringify(params, null, 2));

    // 更新工作流
    const workflow = updateWorkflow(WORKFLOW_TEMPLATE, params);

    // 执行工作流
    const result = await executeComfyUIWorkflow(workflow);

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
//   const result = await handleToolInput(query);
//   return result;
// }

// 导出供测试使用
module.exports = { handleToolInput, parseInput, updateWorkflow };
