# ComfyUI Agent Tool - 使用指南

## 概述

这个 Custom Code Tool 允许 n8n 的 AI Agent 直接调用 ComfyUI 生成图像，实现 AI 对话中的图像生成功能。

## 功能特性

- ✅ **自然语言控制**：AI Agent 可以理解用户的图像生成需求
- ✅ **灵活参数**：支持尺寸、步数、CFG、种子等参数控制
- ✅ **自动轮询**：自动等待并获取生成的图像
- ✅ **错误处理**：完善的错误处理和日志记录
- ✅ **可定制**：可以轻松替换为自己的 ComfyUI 工作流

## 快速开始

### 步骤 1：创建 Custom Code Tool 节点

1. 在 n8n 工作流中添加 **Custom Code Tool** 节点
   - 路径：`LangChain > Sub-nodes > Custom Code Tool`

2. 配置节点参数：
   - **Description**: `Generates images using ComfyUI. Use this tool when the user asks to create, generate, or make images.`
   - **Language**: `JavaScript`
   - **JavaScript Code**: 复制下面的代码（完整版在 `ComfyUI-Agent-Tool.js` 中）

### 步骤 2：配置 AI Agent

1. 添加 **AI Agent** 节点（例如：OpenAI Conversational Agent）

2. 在 **Tools** 部分添加你创建的 Custom Code Tool

3. 配置其他必要的参数（Chat Model, Memory 等）

### 步骤 3：测试

1. 添加 **Chat Trigger** 节点
2. 运行工作流
3. 发送消息，例如："生成一只可爱的猫咪"

## 代码模板（n8n Custom Code Tool）

将以下代码复制到 Custom Code Tool 节点中：

```javascript
// ==================== 配置 ====================
const COMFYUI_URL = 'http://127.0.0.1:8188';

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

// ==================== 工具函数 ====================

function parseInput(query) {
  const params = {
    prompt: query.trim(),
    negative_prompt: 'ugly, blurry, low quality, distorted',
    width: 512,
    height: 512,
    steps: 20,
    cfg: 8,
    seed: Math.floor(Math.random() * 2147483647)
  };

  const negativeMatch = query.match(/negative:\s*([^\n]+)/i);
  if (negativeMatch) {
    params.negative_prompt = negativeMatch[1].trim();
    params.prompt = params.prompt.replace(/negative:\s*[^\n]+/i, '').trim();
  }

  const sizeMatch = query.match(/size:\s*(\d+)x(\d+)/i);
  if (sizeMatch) {
    params.width = parseInt(sizeMatch[1]);
    params.height = parseInt(sizeMatch[2]);
    params.prompt = params.prompt.replace(/size:\s*\d+x\d+/i, '').trim();
  }

  const stepsMatch = query.match(/steps:\s*(\d+)/i);
  if (stepsMatch) {
    params.steps = parseInt(stepsMatch[1]);
    params.prompt = params.prompt.replace(/steps:\s*\d+/i, '').trim();
  }

  const cfgMatch = query.match(/cfg:\s*([\d.]+)/i);
  if (cfgMatch) {
    params.cfg = parseFloat(cfgMatch[1]);
    params.prompt = params.prompt.replace(/cfg:\s*[\d.]+/i, '').trim();
  }

  const seedMatch = query.match(/seed:\s*(\d+)/i);
  if (seedMatch) {
    params.seed = parseInt(seedMatch[1]);
    params.prompt = params.prompt.replace(/seed:\s*\d+/i, '').trim();
  }

  return params;
}

function updateWorkflow(workflow, params) {
  const updatedWorkflow = JSON.parse(JSON.stringify(workflow));
  updatedWorkflow["6"].inputs.text = params.prompt;
  updatedWorkflow["7"].inputs.text = params.negative_prompt;
  updatedWorkflow["5"].inputs.width = params.width;
  updatedWorkflow["5"].inputs.height = params.height;
  updatedWorkflow["3"].inputs.steps = params.steps;
  updatedWorkflow["3"].inputs.cfg = params.cfg;
  updatedWorkflow["3"].inputs.seed = params.seed;
  return updatedWorkflow;
}

async function executeComfyUIWorkflow(workflow) {
  const axios = require('axios');

  const promptResponse = await axios.post(`${COMFYUI_URL}/prompt`, {
    prompt: workflow
  });

  const promptId = promptResponse.data.prompt_id;

  let attempts = 0;
  const maxAttempts = 120;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const historyResponse = await axios.get(`${COMFYUI_URL}/history/${promptId}`);

    if (historyResponse.data[promptId]) {
      const outputs = historyResponse.data[promptId].outputs;

      if (outputs) {
        const images = [];

        for (const nodeId in outputs) {
          if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
            for (const image of outputs[nodeId].images) {
              images.push({
                filename: image.filename,
                url: `${COMFYUI_URL}/view?filename=${image.filename}&subfolder=${image.subfolder}&type=${image.type}`
              });
            }
          }
        }

        return {
          success: true,
          images: images
        };
      }
    }

    attempts++;
  }

  throw new Error('Workflow execution timeout');
}

// ==================== 主处理函数 ====================

for (const item of items) {
  const query = item.json.query || '';

  try {
    const params = parseInput(query);
    const workflow = updateWorkflow(WORKFLOW_TEMPLATE, params);
    const result = await executeComfyUIWorkflow(workflow);

    return {
      json: {
        success: true,
        message: `Generated ${result.images.length} image(s): "${params.prompt}"`,
        images: result.images.map(img => img.url),
        parameters: params
      }
    };

  } catch (error) {
    return {
      json: {
        success: false,
        error: error.message
      }
    };
  }
}
```

## 使用示例

### 示例 1：简单文本生成图像

**用户输入**：
```
生成一只在森林里的狐狸
```

**AI Agent 行为**：
1. 识别用户想要生成图像
2. 调用 ComfyUI 工具
3. 使用默认参数（512x512, 20 steps）
4. 返回生成的图像 URL

### 示例 2：带参数的图像生成

**用户输入**：
```
创建一个赛博朋克城市，size:1024x768, steps:30, cfg:10
```

**AI Agent 行为**：
1. 解析参数：尺寸 1024x768，30 步，CFG 10
2. 使用指定参数生成图像
3. 返回高清图像

### 示例 3：使用负向提示词

**用户输入**：
```
画一个美丽的日落，negative: 模糊, 低质量, 变形
```

**AI Agent 行为**：
1. 正向提示词："画一个美丽的日落"
2. 负向提示词："模糊, 低质量, 变形"
3. 生成高质量图像

### 示例 4：使用固定种子

**用户输入**：
```
生成一只猫，seed:12345
```

**AI Agent 行为**：
1. 使用种子 12345
2. 可以复现相同的图像

## 参数说明

### 自然语言参数

可以在文本中包含以下参数（不区分大小写）：

| 参数 | 格式 | 示例 | 默认值 |
|------|------|------|--------|
| 尺寸 | `size:WIDTHxHEIGHT` | `size:1024x768` | 512x512 |
| 步数 | `steps:N` | `steps:30` | 20 |
| CFG | `cfg:N` | `cfg:8` | 8 |
| 种子 | `seed:N` | `seed:12345` | 随机 |
| 负向提示词 | `negative:TEXT` | `negative: ugly` | ugly, blurry, low quality |

### 工作流定制

**如何使用自己的工作流**：

1. 在 ComfyUI 中创建你的工作流
2. 点击 **Save (API Format)** 导出
3. 将导出的 JSON 替换代码中的 `WORKFLOW_TEMPLATE`
4. 根据你的工作流调整 `updateWorkflow()` 函数

**示例**：

```javascript
// 假设你的工作流有这些节点：
// - 节点 1: CheckpointLoaderSimple (模型加载)
// - 节点 5: KSampler (采样器)
// - 节点 6: CLIPTextEncode (正向提示词)
// - 节点 7: CLIPTextEncode (负向提示词)

function updateWorkflow(workflow, params) {
  workflow["6"].inputs.text = params.prompt;      // 正向提示词
  workflow["7"].inputs.text = params.negative_prompt;  // 负向提示词
  workflow["5"].inputs.seed = params.seed;        // 种子
  workflow["5"].inputs.steps = params.steps;      // 步数
  workflow["5"].inputs.cfg = params.cfg;          // CFG
  return workflow;
}
```

## 高级用法

### 1. 多模型支持

```javascript
// 在查询中检测模型
const modelMatch = query.match(/model:\s*(\w+)/i);
if (modelMatch) {
  const modelName = modelMatch[1];
  workflow["1"].inputs.ckpt_name = `${modelName}.ckpt`;
}
```

### 2. 图像变体（图生图）

```javascript
// 检测输入图像
if (item.binary && item.binary.data) {
  // 使用图像作为输入
  workflow["10"].inputs.image = item.binary.data;
  workflow["5"].inputs.denoise = 0.75;  // 图生图的 denoise 值
}
```

### 3. 批量生成

```javascript
// 批量大小
const batchMatch = query.match(/batch:\s*(\d+)/i);
if (batchMatch) {
  workflow["5"].inputs.batch_size = parseInt(batchMatch[1]);
}
```

## 完整工作流示例

### n8n 工作流 JSON

```json
{
  "name": "AI Agent with ComfyUI",
  "nodes": [
    {
      "parameters": {},
      "name": "Chat Trigger",
      "type": "n8n-nodes-langchain.chatTrigger",
      "typeVersion": 1.3,
      "position": [250, 300]
    },
    {
      "parameters": {
        "toolDescriptions": [
          {
            "tool": "ComfyUI Image Generator",
            "description": "Generates images using ComfyUI"
          }
        ]
      },
      "name": "OpenAI Conversational Agent",
      "type": "n8n-nodes-langchain.agent.openAi",
      "typeVersion": 1.7,
      "position": [450, 300]
    },
    {
      "parameters": {
        "language": "javaScript",
        "jsCode": "// 这里粘贴上面的代码"
      },
      "name": "ComfyUI Tool",
      "type": "n8n-nodes-langchain.toolCode",
      "typeVersion": 1,
      "position": [450, 500]
    }
  ],
  "connections": {
    "Chat Trigger": {
      "main": [
        [
          {
            "node": "OpenAI Conversational Agent",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## 故障排除

### 问题 1：工具未被调用

**原因**：Description 不够清晰

**解决**：
```
描述应该是：
"Generates images using ComfyUI. Use this tool when the user asks to create, generate, make, draw, or paint images."
```

### 问题 2：连接 ComfyUI 失败

**原因**：ComfyUI 未运行或 URL 错误

**解决**：
```javascript
// 检查 ComfyUI 是否运行
const testResponse = await axios.get(`${COMFYUI_URL}/system_stats`);
console.log('ComfyUI is running:', testResponse.status === 200);
```

### 问题 3：工作流执行超时

**原因**：默认超时时间太短

**解决**：
```javascript
// 增加最大尝试次数
const maxAttempts = 180;  // 3 分钟
```

### 问题 4：生成的图像质量差

**原因**：参数设置不当

**解决**：
```javascript
// 使用更好的默认参数
const params = {
  steps: 30,      // 增加到 30 步
  cfg: 7.5,       // 降低 CFG
  width: 768,     // 使用更高分辨率
  height: 768
};
```

## 性能优化

### 1. 并发执行

```javascript
// 批量生成多个图像
const prompts = ['cat', 'dog', 'bird'];
const results = await Promise.all(
  prompts.map(p => handleToolInput(p))
);
```

### 2. 缓存结果

```javascript
// 缓存相同提示词的结果
const cache = new Map();
const cacheKey = JSON.stringify(params);

if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}

const result = await executeComfyUIWorkflow(workflow);
cache.set(cacheKey, result);
```

### 3. 流式响应

```javascript
// 在生成过程中更新进度
for (let i = 0; i < maxAttempts; i++) {
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 检查进度
  const progress = await checkProgress(promptId);
  console.log(`Progress: ${progress}%`);

  if (progress === 100) break;
}
```

## 扩展功能

### 1. 支持视频生成

```javascript
// 添加视频支持
if (outputs[nodeId].videos) {
  for (const video of outputs[nodeId].videos) {
    videos.push({
      filename: video.filename,
      url: `${COMFYUI_URL}/view?filename=${video.filename}`
    });
  }
}
```

### 2. 图像编辑

```javascript
// 支持图像编辑工作流
if (query.includes('edit') || query.includes('modify')) {
  // 使用图生图工作流
  workflow = IMG2IMG_WORKFLOW_TEMPLATE;
}
```

### 3. 风格迁移

```javascript
// 检测风格迁移请求
const styleMatch = query.match(/style:\s*(\w+)/i);
if (styleMatch) {
  const style = styleMatch[1];
  // 应用风格预设
  workflow = STYLE_TRANSFER_WORKFLOWS[style];
}
```

## 相关资源

- [n8n Custom Code Tool 文档](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolcode/)
- [n8n AI Agent 文档](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)
- [ComfyUI GitHub](https://github.com/comfyanonymous/ComfyUI)
- [ComfyUI 文档](https://docs.comfy.org/)

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
