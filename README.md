# n8n-nodes-comfyui-all

> Execute ComfyUI workflows in n8n - Generate images, videos, and more with AI!

[![npm version](https://badge.fury.io/js/n8n-nodes-comfyui-all.svg)](https://www.npmjs.com/package/n8n-nodes-comfyui-all)

## Video Tutorials

- 📺 [YouTube Tutorial](https://youtu.be/wsbo3hBKsPM)
- 📺 [哔哩哔哩教程](https://www.bilibili.com/video/BV1ffrFBTEdQ/?vd_source=6485fe2fae664d8b09cb2e2fd7df5ef7)

## What This Does

This package adds **two nodes** to n8n that let you run ComfyUI workflows:

1. **ComfyUI Tool** - For AI Agents (URL-based image input)
2. **ComfyUI** - For standard workflows (supports binary & URL)

You can use these nodes to:
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

Add either **ComfyUI Tool** or **ComfyUI** node to your workflow!

---

## ComfyUI Tool vs ComfyUI Node

### ComfyUI Tool 🤖

**Use for: AI Agent workflows**

```
Example:
[Chat Input] → [AI Agent] → [ComfyUI Tool]
```

**Features:**
- ✅ Simple URL-based image input
- ✅ Works great with AI Agents
- ✅ Doesn't bloat LLM context (URLs are small!)
- ✅ Automatic image download

**How to use:**
1. Add to AI Agent as a tool
2. Set ComfyUI URL
3. Paste your ComfyUI workflow JSON
4. Set Load Image Node ID (if using images)
5. Pass image URL: `{{ $json.imageUrl }}`

**Example:**
```json
{
  "imageUrl": "https://example.com/image.png",
  "prompt": "Transform to oil painting"
}
```

---

### ComfyUI Node 🔧

**Use for: Standard n8n workflows**

```
Example:
[HTTP Request] → [ComfyUI] → [Save File]
```

**Features:**
- ✅ Supports binary data (from previous nodes)
- ✅ Supports URL download
- ✅ Advanced parameter configuration
- ✅ Binary output for further processing

**How to use:**

**Option 1: Binary Input**
```
ComfyUI URL: http://127.0.0.1:8188
Workflow JSON: [Your workflow]

Node Parameters:
  Node ID: 107
  Type: Image
  Image Input Type: Binary
  Value: data
```

**Option 2: URL Input**
```
ComfyUI URL: http://127.0.0.1:8188
Workflow JSON: [Your workflow]

Node Parameters:
  Node ID: 107
  Type: Image
  Image Input Type: URL
  Image URL: https://example.com/image.png
```

**Option 3: Text Input**
```
Node Parameters:
  Node ID: 6
  Type: Text
  Value: {{ $json.prompt }}
```

---

## Common Workflows

### 1. Generate Image from Text

**Setup:**
```
ComfyUI Node:
  ComfyUI URL: http://127.0.0.1:8188
  Workflow JSON: [Text-to-Image workflow]

  Node Parameters:
    Node ID: 6 (your CLIP Text node)
    Type: Text
    Value: {{ $json.prompt }}
```

**Input:**
```json
{ "prompt": "a beautiful sunset over mountains" }
```

**Output:**
```json
{
  "imageUrls": ["http://127.0.0.1:8188/view?filename=image.png"]
}
```

---

### 2. Process Image with AI Agent

**Workflow:**
```
[Chat Interface] → [AI Agent] → [ComfyUI Tool]
```

**ComfyUI Tool Setup:**
```
ComfyUI URL: http://127.0.0.1:8188
Workflow JSON: [Image-to-Image workflow]
Load Image Node ID: 107
Image URL: {{ $json.imageUrl }}
```

**Chat:**
```
You: Transform this image https://example.com/photo.png
     to watercolor style

AI: I'll transform that image for you!
    [Downloads image, processes in ComfyUI]
    Done! Here's your watercolor image 🎨
```

---

### 3. Edit Image with Parameters

**ComfyUI Node Setup:**
```
Node Parameters:
  Node ID: 3
  Parameter Mode: Multiple Parameters
  Parameters JSON:
    {
      "width": 1024,
      "height": 1024,
      "steps": 30
    }
```

---

### 4. Generate Video

Same as image generation, just use a video workflow in ComfyUI!

**Output:**
```json
{
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

## Parameters Explained

### ComfyUI Tool Node

| Parameter | What It Does | Example |
|-----------|--------------|---------|
| **ComfyUI URL** | Where ComfyUI is running | `http://127.0.0.1:8188` |
| **Workflow JSON** | Your ComfyUI workflow (API format) | `{...}` |
| **Timeout** | Max wait time (seconds) | `300` |
| **Load Image Node ID** | Which LoadImage node to use | `107` |
| **Image URL** | URL of image to process | `https://...` |
| **Parameter Overrides** | Change workflow values | See below |

### ComfyUI Node

| Parameter | What It Does | Example |
|-----------|--------------|---------|
| **ComfyUI URL** | Where ComfyUI is running | `http://127.0.0.1:8188` |
| **Workflow JSON** | Your ComfyUI workflow (API format) | `{...}` |
| **Timeout** | Max wait time (seconds) | `300` |
| **Output Binary Key** | Name for output binary | `data` |
| **Node Parameters** | Configure workflow parameters | See below |

### Node Parameters

| Field | What It Does |
|-------|--------------|
| **Node ID** | The ComfyUI node to change (e.g., "6", "13") |
| **Parameter Mode** | "Single" for one parameter, "Multiple" for JSON |
| **Type** | Text, Number, Boolean, or Image |
| **Value** | The value to set |

---

## Tips & Tricks

### ✅ Use URLs with AI Agents

URLs are much smaller than base64 images:
```
Base64:  ~100KB - 1MB per image
URL:     ~100 bytes

Better for LLM context and costs!
```

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

### ✅ Test First

Always test your workflow in ComfyUI before using it in n8n!

### ✅ Use Appropriate Timeouts

```
Simple workflows:  60-120 seconds
Complex workflows: 300-600 seconds
Video generation:  600-1800 seconds
```

---

## Troubleshooting

### "Invalid ComfyUI URL"
Make sure ComfyUI is running and URL is correct: `http://127.0.0.1:8188`

### "Workflow execution timeout"
Increase the timeout value in node settings

### "Node ID not found"
Check your workflow JSON - Node IDs are strings like "6", not numbers

### "Failed to download image"
Make sure the URL is public and accessible (not localhost or file://)

### "AI Agent doesn't call ComfyUI"
- Make sure ComfyUI Tool is added to Agent's tools
- Check the workflow JSON is set
- Try being more specific in your chat

---

## Examples

### Example 1: Simple Text to Image

```
[Manual Trigger] → [ComfyUI] → [Save to File]

ComfyUI Node:
  Workflow: Text-to-Image
  Node ID: 6
  Type: Text
  Value: a cute cat in a garden
```

### Example 2: AI Image Generator

```
[Chat Trigger] → [AI Agent + ComfyUI Tool] → [Display Image]

Agent says: "Generate a picture of..."
Calls: ComfyUI Tool
Returns: Image URL
Shows: Result to user
```

### Example 3: Batch Process Images

```
[Spreadsheet] → [Loop] → [ComfyUI] → [Save]

For each row:
  - Get image URL
  - Process in ComfyUI
  - Save result
```

---

## Need Help?

- 📖 [n8n Documentation](https://docs.n8n.io)
- 💬 [n8n Community](https://community.n8n.io)
- 🐛 [Report Issues](https://github.com/your-repo/issues)

---

## License

MIT

---

**Happy automating with ComfyUI! 🚀**
