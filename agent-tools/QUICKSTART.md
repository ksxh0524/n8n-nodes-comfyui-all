# ComfyUI AI Agent Tool - 快速开始

## 30 秒快速设置

### 步骤 1：创建 Custom Code Tool

在 n8n 中创建一个新的 **Custom Code Tool** 节点：

- **Description**: `Generates images using ComfyUI. Use this tool when the user asks to create, generate, make, draw, or paint images.`
- **Language**: `JavaScript`
- **Code**: 复制 `ComfyUI-Agent-Tool.js` 中的代码

### 步骤 2：创建 AI Agent

添加 **OpenAI Conversational Agent** 节点：
- 在 **Tools** 部分选择刚创建的 ComfyUI Tool
- 配置 OpenAI API credentials

### 步骤 3：测试

添加 **Chat Trigger** 节点并连接到 AI Agent，然后发送：
```
生成一只可爱的猫咪
```

## 完整示例

见 `example-workflow.json` 或参考主文档 `README.md`

## 常用命令

### 基础图像生成
```
生成一只在森林里的狐狸
create a cyberpunk city at night
画一个美丽的日落
```

### 带参数的生成
```
创建一个城市，size:1024x768, steps:30, cfg:10
生成猫咪，seed:12345
画风景，negative: 模糊, 低质量
```

## 参数说明

| 参数 | 格式 | 示例 | 默认值 |
|------|------|------|--------|
| 尺寸 | `size:WxH` | `size:1024x768` | 512x512 |
| 步数 | `steps:N` | `steps:30` | 20 |
| CFG | `cfg:N` | `cfg:8` | 8 |
| 种子 | `seed:N` | `seed:12345` | 随机 |
| 负向 | `negative:TEXT` | `negative: ugly` | ugly, blurry |

## 需要帮助？

- **详细文档**: `README.md`
- **完整代码**: `ComfyUI-Agent-Tool.js`
- **工作流示例**: `example-workflow.json`

## 前置要求

- ✅ ComfyUI 运行在 `http://127.0.0.1:8188`
- ✅ n8n 已安装并运行
- ✅ OpenAI API key（或使用其他 LLM）

## 故障排除

**工具未被调用？**
→ 检查 Description 是否清晰明确

**连接 ComfyUI 失败？**
→ 确保 ComfyUI 正在运行

**生成超时？**
→ 检查 ComfyUI 日志，确认工作流有效

---

**祝你使用愉快！** 🎨
