# n8n-nodes-comfyui-all

> Execute ComfyUI workflows in n8n - Generate images, videos, and more with AI!

[![npm version](https://badge.fury.io/js/n8n-nodes-comfyui-all.svg)](https://www.npmjs.org/package/n8n-nodes-comfyui-all)

## Video Tutorials

| Platform | Link | Description |
|----------|------|-------------|
| 📺 YouTube | [Watch Tutorial](https://youtu.be/wsbo3hBKsPM) | English tutorial |
| 📺 Bilibili | [观看教程](https://www.bilibili.com/video/BV1ffrFBTEdQ/?vd_source=6485fe2fae664d8b09cb2e2fd7df5ef7) | 中文教程 |

## What This Does

This package adds **one intelligent node** to n8n that automatically detects how it's being used:

**ComfyUI Node** - Universal ComfyUI workflow executor
- ✅ **Auto-detects execution mode** (Tool for AI Agents or Action for workflows)
- ✅ **Manual mode override** available
- ✅ **Works with AI Agents** as a tool
- ✅ **Works in regular workflows** with full binary support
- ✅ **Supports URL and binary image input**
- ✅ **Dynamic parameter overrides**

You can use this node to:
- Generate images from text prompts
- Process and edit images
- Generate videos
- Use AI Agents to create images automatically
- And much more with any ComfyUI workflow!

---

## Quick Setup

### 1. Install

```bash
# n8n Cloud: Settings → Community Nodes → Install → n8n-nodes-comfyui-all

# Self-hosted:
cd ~/.n8n
npm install n8n-nodes-comfyui-all
```

### 2. Run ComfyUI

Make sure ComfyUI is running:
```bash
# Default: http://127.0.0.1:8188
```

### 3. Use in n8n

Add the **ComfyUI** node to your workflow! It will automatically detect the best execution mode.

---

## How It Works

### Execution Modes

The ComfyUI node supports three execution modes:

**Auto Detect** (default):
- Automatically detects the best mode based on context
- Uses Tool mode when called by AI Agents
- Uses Action mode for regular workflows

**Tool Mode** (for AI Agents):
```
[Chat Input] → [AI Agent] → [ComfyUI]
```
- Detects AI Agent context
- Returns image URLs (compact, LLM-friendly)
- Supports URL image input
- Dynamic parameter overrides
- Optimized for AI Agent interactions

**Action Mode** (for regular workflows):
```
[HTTP Request] → [ComfyUI] → [Save File]
```
- Used in standard workflows
- Returns full binary data
- Supports URL and binary image input
- Full workflow integration

### Detection Priority

When using Auto Detect mode, the node checks in this order:
1. **n8n API** - Checks if called by AI Agent via `isToolExecution()`
2. **Execution Context** - Checks for chat mode context
3. **Input Data** - Checks for AI Agent markers in input data
4. **Heuristics** - Analyzes input characteristics
5. **Default** - Falls back to Action mode

### Smart Warnings

The node provides intelligent warnings when:
- Manual mode selection conflicts with high-confidence detection
- Helps prevent configuration mistakes
- Always shows detection results for transparency

---

## Parameters Explained

### Main Parameters

| Parameter | What It Does | Example |
|-----------|--------------|---------|
| **ComfyUI URL** | Where ComfyUI is running | `http://127.0.0.1:8188` |
| **Workflow JSON** | Your ComfyUI workflow (API format) | `{...}` |
| **Timeout** | Max wait time for execution (seconds) | `300` (5 minutes) |
| **Output Binary Key** | Property name for output binary data | `data` |
| **Execution Mode** | Auto/Tool/Action mode selection | `Auto Detect` |
| **Node Parameters** | Dynamic workflow parameter overrides | See below |

### Node Parameters

These allow you to dynamically override any value in your ComfyUI workflow.

| Field | What It Does |
|-------|--------------|
| **Node ID** | The ComfyUI node to change (e.g., "6", "13") |
| **Parameter Mode** | "Single" for one parameter, "Multiple" for JSON object |
| **Type** | Text, Number, Boolean, or Image |
| **Value** | The value to set (for single mode) |
| **Image Input Type** | URL or Binary (for image type) |
| **Image URL** | URL of image (when using URL input) |
| **Parameters JSON** | JSON object with multiple parameters |

---

## Usage Examples

### Example 1: Generate Image with AI Agent

**Workflow:**
```
[Chat Interface] → [AI Agent] → [ComfyUI]
```

**Setup:**
1. Add ComfyUI to AI Agent tools
2. Configure ComfyUI node:
   - **ComfyUI URL**: `http://127.0.0.1:8188`
   - **Workflow JSON**: Your text-to-image workflow
   - **Execution Mode**: `Auto Detect`
   - **Timeout**: `300`

**Chat:**
```
You: Generate an image of a sunset over mountains

AI: I'll generate that image for you!
     [Automatically uses Tool mode]
     Done! Here's your image 🎨
     [Returns image URL]
```

**Output:**
```json
{
  "success": true,
  "imageUrls": ["http://127.0.0.1:8188/view?filename=image.png"],
  "imageCount": 1
}
```

---

### Example 2: Process Image in Workflow

**Workflow:**
```
[HTTP Request] → [ComfyUI] → [Save to File]
```

**Setup:**
```
ComfyUI URL: http://127.0.0.1:8188
Workflow JSON: [Your image processing workflow]
Execution Mode: Action Mode

Node Parameters:
  Node ID: 107
  Type: Image
  Image Input Type: URL
  Image URL: https://example.com/image.png
```

**Output (Action mode with binary):**
```json
{
  "success": true,
  "data": {...},
  "binary": {
    "data": {
      "data": "base64_encoded_image",
      "mimeType": "image/png",
      "fileName": "ComfyUI_00001.png"
    }
  },
  "imageCount": 1
}
```

---

### Example 3: Dynamic Text Prompt

**Setup:**
```
ComfyUI Node:
  ComfyUI URL: http://127.0.0.1:8188
  Workflow JSON: [Text-to-Image workflow]
  Execution Mode: Auto Detect

Node Parameters:
  Node ID: 6 (CLIP Text node)
  Type: Text
  Value: {{ $json.prompt }}
```

**Input:**
```json
{ "prompt": "a cyberpunk city at night, neon lights" }
```

---

### Example 4: Multiple Parameters

**Setup:**
```
Node Parameters:
  Node ID: 3
  Parameter Mode: Multiple Parameters
  Parameters JSON:
    {
      "width": 1024,
      "height": 1024,
      "steps": 30,
      "cfg_scale": 8
    }
```

---

### Example 5: Generate Video

Same as image generation, just use a video workflow!

**Output:**
```json
{
  "success": true,
  "videoUrls": ["http://127.0.0.1:8188/view?filename=video.mp4"],
  "videoCount": 1
}
```

---

## How to Get Your Workflow JSON

1. Open ComfyUI
2. Create or load your workflow
3. Click **"Save (API Format)"** (not "Save")
4. Copy the JSON
5. Paste it in the node's **Workflow JSON** field

---

## Tips & Tricks

### ✅ Find Your Node ID

Open your workflow JSON and look for:
```json
{
  "6": {
    "inputs": {...},
    "class_type": "KSampler"
  }
}
```
The `"6"` is your Node ID!

### ✅ URL vs Binary Input

**Use URL when:**
- Working with AI Agents (smaller context)
- Images are publicly accessible
- Processing multiple images
- Tool Mode execution

**Use Binary when:**
- Images are from previous n8n nodes
- Working with local files
- Need full image data in workflow
- Action Mode execution

### ✅ Test First

Always test your workflow in ComfyUI before using it in n8n!

### ✅ Use Appropriate Timeouts

```
Simple workflows:      60-120 seconds
Complex workflows:     300-600 seconds
Video generation:      600-1800 seconds
```

### ✅ Execution Mode Tips

- Use **Auto Detect** for most cases
- Use **Tool Mode** when specifically working with AI Agents
- Use **Action Mode** for standard workflow processing
- Check n8n logs for detection results and warnings

---

## Troubleshooting

### "Invalid ComfyUI URL"
- Make sure ComfyUI is running
- Check the URL format: `http://127.0.0.1:8188` or `http://localhost:8188`

### "Workflow execution timeout"
- Increase the timeout value in node settings
- Check if ComfyUI is processing the workflow

### "Node ID not found"
- Check your workflow JSON
- Node IDs are strings like "6", "3", "13"
- Make sure the node exists in your workflow

### "Failed to download image"
- Make sure the URL is publicly accessible
- Cannot use localhost URLs in Tool mode
- Check network connectivity

### "Binary property not found"
- Check the previous node's "Output Binary Key" setting
- Make sure binary data exists in input
- Verify the property name matches

### "AI Agent doesn't call ComfyUI"
- Make sure ComfyUI is added to Agent's tools
- Check the workflow JSON is set
- Try being more specific in your chat: "Generate an image of..." instead of "Help me with images"

### "Tool mode doesn't support binary input"
- Use URL input instead of binary in Tool mode
- Or switch to Action mode if you need binary support

---

## Architecture & Improvements

### Recent Enhancements (v2.4.15)

**🎯 Execution Mode Control**
- Auto Detect mode for smart detection
- Manual Tool/Action mode override
- Intelligent warnings on mode conflicts

**🤖 Smart Mode Detection**
- Primary: n8n API `isToolExecution()`
- Secondary: Execution context (chat mode)
- Tertiary: AI Agent metadata markers
- Fallback: Heuristic analysis
- Default: Action mode

**📦 Modular Architecture**
- `ImageProcessor` - Dedicated image handling
- `ParameterTypeHandler` - Type conversion logic
- `ParameterProcessor` - Main coordinator
- `executionModeDetector` - Multi-layer mode detection
- `ComfyUiClient` - HTTP client with retry logic

**✅ Code Quality**
- ESLint v9 flat config
- Zero non-null assertions
- Comprehensive type validation
- All ES6 imports
- Config object pattern

---

## What's New

### Latest Updates (v2.4.15+)

**Bug Fixes** (Commit: 3891f1b1):
- ✅ Fixed video processing loop index error
- ✅ Added null check for videoBuffer to prevent undefined errors
- ✅ Tool mode and Action mode now have identical UI (both support parameters)

**Recent Enhancements**:
- ✅ Execution Mode parameter (Auto/Tool/Action)
- ✅ Multi-layer detection strategy (5 levels)
- ✅ Smart warning system for mode conflicts
- ✅ UI text optimization

---

## Need Help?

- 📖 [n8n Documentation](https://docs.n8n.io)
- 💬 [n8n Community](https://community.n8n.io)
- 🐛 [Report Issues](https://github.com/ksxh0524/n8n-nodes-comfyui-all/issues)
- 📧 Email: ksxh0524@outlook.com

---

## License

MIT

---

**Happy automating with ComfyUI! 🚀**
