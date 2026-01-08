# n8n-nodes-comfyui-all

> n8n community node for integrating ComfyUI workflows into n8n automation platform.

[![npm version](https://badge.fury.io/js/n8n-nodes-comfyui-all.svg)](https://www.npmjs.com/package/n8n-nodes-comfyui-all)

## 📖 Table of Contents

- [Overview](#-overview)
- [Installation](#-installation)
- [Nodes Comparison](#-nodes-comparison)
- [Quick Start](#-quick-start)
- [ComfyUI Tool Node](#-comfyui-tool-node)
- [ComfyUI Node](#-comfyui-node)
- [Advanced Usage](#-advanced-usage)
- [Troubleshooting](#-troubleshooting)
- [Configuration Reference](#-configuration-reference)

## 🎯 Overview

This package provides two specialized nodes for integrating ComfyUI with n8n:

### 🌟 Key Features

- 🎨 **Universal Workflow Support** - Works with any ComfyUI workflow in API format
- 🔄 **Dynamic Parameters** - Override workflow parameters at runtime
- 🎬 **Multi-Modal Support** - Supports images and videos for both input and output
- 🤖 **AI Agent Ready** - Optimized nodes for AI Agent and standard workflows
- 📊 **Flexible Configuration** - JSON mode or single parameter mode
- 🏷️ **Customizable Output** - Flexible output format (URLs or binary data)

---

## 📦 Installation

### n8n Cloud

1. Go to **Settings** → **Community Nodes**
2. Click **Install**
3. Enter: `n8n-nodes-comfyui-all`
4. Click **Install**

### Self-Hosted n8n

```bash
cd ~/.n8n
npm install n8n-nodes-comfyui-all
```

Or via n8n interface: **Settings** → **Community Nodes** → **Install** → `n8n-nodes-comfyui-all`

> ⚠️ **Restart n8n after installation**

---

## 🔍 Nodes Comparison

### Quick Reference

| Feature | ComfyUI Tool 🤖 | ComfyUI 🔧 |
|---------|----------------|------------|
| **Primary Use Case** | AI Agent Workflows | Standard Workflows |
| **Image Input** | URL only | Binary or URL |
| **Binary Output** | ❌ No | ✅ Yes |
| **URL Output** | ✅ Yes | ✅ Yes |
| **Parameter Overrides** | ✅ Yes | ✅ Yes (Advanced) |
| **LLM Context** | ✅ Lightweight (URLs only) | ⚠️ Not optimized |
| **Node Configuration** | Simple | Advanced |

### Which Node Should I Use?

```
┌─────────────────────────────────────────────────────────────┐
│  Your Scenario                                           │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
     Using AI Agent?              Standard Workflow?
            │                               │
            ▼                               ▼
    ┌───────────────┐              ┌──────────────┐
    │ ComfyUI Tool  │              │   ComfyUI    │
    └───────────────┘              └──────────────┘
            │                               │
     Image Input: URL              Image Input:
                                    • Binary
                                    • URL
```

#### Use ComfyUI Tool When:
- ✅ Building AI Agent workflows
- ✅ Integrating with chat interfaces
- ✅ Processing images from URLs
- ✅ Minimizing LLM token usage
- ✅ Need simple URL-based configuration

#### Use ComfyUI Node When:
- ✅ Building standard n8n workflows
- ✅ Processing binary data from previous nodes
- ✅ Working with file uploads/webhooks
- ✅ Need advanced parameter configuration
- ✅ Want binary output for further processing

---

## 🚀 Quick Start

### Prerequisites

- ✅ ComfyUI server running (default: `http://127.0.0.1:8188`)
- ✅ n8n instance (version 2.x or higher)
- ✅ Basic understanding of ComfyUI workflows

### 3-Step Setup

#### 1. Create Your Workflow in ComfyUI

```
In ComfyUI:
1. Design your workflow
2. Click "Save (API Format)"
3. Copy the generated JSON
```

#### 2. Add Node to n8n

```
In n8n:
1. Add either "ComfyUI Tool" or "ComfyUI" node
2. Paste your Workflow JSON
3. Configure ComfyUI URL
4. (Optional) Set up parameters
```

#### 3. Execute

```
Run your workflow and enjoy! 🎉
```

---

## 🤖 ComfyUI Tool Node

### Overview

**Optimized for AI Agent workflows** - URL-based image input, simple configuration, LLM-friendly.

### Why URL-Based Input?

```
❌ Base64 Image:
   - Size: ~100KB - 1MB per image
   - Tokens: ~130K - 1.3M tokens
   - Result: 💥 Explodes LLM context

✅ Image URL:
   - Size: ~100 bytes
   - Tokens: ~30 tokens
   - Result: ✅ Lightweight and efficient
```

### Configuration

#### Basic Setup

```
┌─────────────────────────────────────────────────┐
│ ComfyUI Tool                                    │
├─────────────────────────────────────────────────┤
│ ComfyUI URL:     http://127.0.0.1:8188         │
│ Workflow JSON:   [Your ComfyUI workflow]        │
│ Timeout:         300                            │
│ Load Image Node ID:                             │
│   (for image workflows)                         │
│ Image URL:       [URL or {{ $json.imageUrl }}] │
└─────────────────────────────────────────────────┘
```

#### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| **ComfyUI URL** | ComfyUI server address | `http://127.0.0.1:8188` |
| **Workflow JSON** | ComfyUI workflow in API format | `{ "3": {...} }` |
| **Timeout** | Max wait time (seconds) | `300` (5 min) |
| **Load Image Node ID** | LoadImage node ID for image workflows | `107` |
| **Image URL** | URL of image to process | `https://...` |
| **Parameter Overrides** | Override workflow parameters | See below |

### Output Format

```json
{
  "success": true,
  "imageUrls": [
    "http://127.0.0.1:8188/view?filename=ComfyUI_00001.png"
  ],
  "videoUrls": [],
  "imageCount": 1,
  "videoCount": 0
}
```

### AI Agent Integration Example

```
Workflow:
[Chat Input] → [AI Agent] → [ComfyUI Tool]
                          ↓
                    Passes imageUrl
                          ↓
                    Downloads image
                          ↓
                    Processes in ComfyUI
                          ↓
                    Returns result URLs
```

**Chat Example:**

```
User: Transform this image (https://example.com/photo.png)
       to oil painting style

AI Agent:
1. Extracts URL from message
2. Calls ComfyUI Tool
3. ComfyUI Tool downloads image
4. Processes in ComfyUI
5. Returns result URLs
6. AI Agent shows result to user
```

---

## 🔧 ComfyUI Node

### Overview

**Full-featured node for standard workflows** - Supports binary and URL inputs with advanced configuration.

### Configuration

#### Basic Setup

```
┌─────────────────────────────────────────────────┐
│ ComfyUI                                         │
├─────────────────────────────────────────────────┤
│ ComfyUI URL:     http://127.0.0.1:8188         │
│ Workflow JSON:   [Your ComfyUI workflow]        │
│ Timeout:         300                            │
│ Output Binary Key: data                         │
├─────────────────────────────────────────────────┤
│ Node Parameters:                                │
│   [Multiple parameter configurations]            │
└─────────────────────────────────────────────────┘
```

#### Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| **ComfyUI URL** | ComfyUI server address | `http://127.0.0.1:8188` |
| **Workflow JSON** | ComfyUI workflow in API format | `{ "3": {...} }` |
| **Timeout** | Max wait time (seconds) | `300` (5 min) |
| **Output Binary Key** | First output binary property name | `data`, `image` |
| **Node Parameters** | Override workflow parameters | See below |

### Image Input Methods

#### Method 1: Binary Data

```
Node Parameters:
  Node ID: 107
  Parameter Mode: Single Parameter
  Parameter Name: image
  Type: Image
  Image Input Type: Binary  ← Binary mode
  Value: data
```

**Use when:** Previous node outputs binary data (HTTP Request, Webhook, etc.)

#### Method 2: URL

```
Node Parameters:
  Node ID: 107
  Parameter Mode: Single Parameter
  Parameter Name: image
  Type: Image
  Image Input Type: URL  ← URL mode
  Image URL: https://example.com/image.png
```

**Use when:** Downloading from web or using URL

### Output Format

```json
{
  "json": {
    "success": true,
    "imageCount": 1,
    "imageUrls": ["http://..."],
    "data": { ... }
  },
  "binary": {
    "data": {
      "data": "base64...",
      "mimeType": "image/png",
      "fileName": "ComfyUI_00001.png"
    }
  }
}
```

---

## 📚 Advanced Usage

### 1. Text-to-Image with Dynamic Prompts

**ComfyUI Node Setup:**

```
Node Parameters:
  Node ID: 6 (CLIP Text Encode)
  Parameter Mode: Single Parameter
  Parameter Name: text
  Type: Text
  Value: {{ $json.prompt }}
```

**Input:**
```json
{
  "prompt": "a beautiful landscape at sunset"
}
```

### 2. Image-to-Image Processing

**ComfyUI Tool Setup:**

```
Load Image Node ID: 107
Image URL: {{ $json.imageUrl }}
Parameter Overrides:
  - Node ID: 6
    Param Path: inputs.text
    Value: {{ $json.prompt }}
```

**Input:**
```json
{
  "imageUrl": "https://example.com/input.png",
  "prompt": "Transform to oil painting style"
}
```

### 3. Multiple Parameters Override

**ComfyUI Node Setup:**

```
Node Parameters:
  Node ID: 3
  Parameter Mode: Multiple Parameters
  Parameters JSON:
    {
      "width": 1024,
      "height": 1024,
      "steps": 30,
      "cfg": 7.5,
      "seed": 123456
    }
```

### 4. Video Generation

**Setup:** Similar to image generation, just use a video workflow in ComfyUI.

**Output:**
```json
{
  "videoUrls": ["http://127.0.0.1:8188/view?filename=video.mp4"],
  "videoCount": 1
}
```

---

## 🤖 AI Agent Workflows

### Example 1: Image Generation Chat

```
Workflow:
[Chat Interface] → [AI Agent] → [ComfyUI Tool]

Configuration:
  - Model: GPT-4
  - Tools: ComfyUI Tool
  - Workflow: Text-to-Image

Conversation:
  User: "Generate a picture of a cute cat"
  AI: [Calls ComfyUI Tool]
  AI: "Here's your image! 😊"
```

### Example 2: Image Editing

```
Workflow:
[Chat Interface] → [AI Agent] → [ComfyUI Tool]

Configuration:
  - ComfyUI Tool:
    - Workflow: Image-to-Image
    - Load Image Node ID: 107
    - Image URL: {{ $json.imageUrl }}

Conversation:
  User: "Transform this image (URL) to watercolor style"
  AI: [Extracts URL, downloads image, processes in ComfyUI]
  AI: "Done! Here's the watercolor version 🎨"
```

### Example 3: Multi-Modal Workflow

```
Workflow:
[Chat Input] → [AI Agent] → [ComfyUI Tool] → [Chat Model]
                          ↓                           ↓
                      Generate Image               Write Poem
                          ↓                           ↓
                      Return Combined Result

Conversation:
  User: "Create an image of a futuristic city
        and write a poem about it"

  AI: [1. Generates image via ComfyUI Tool]
      [2. Writes poem about the image]
      [3. Returns both to user]
```

---

## ⚙️ Best Practices

### 1. URL Selection

✅ **Good:**
```
https://cdn.example.com/images/photo.png
https://storage.googleapis.com/bucket/image.jpg
https://s3.amazonaws.com/bucket/photo.png
```

❌ **Avoid:**
```
file:///local/path/image.png  ← Not accessible
http://localhost:8080/image.png  ← Private network
```

### 2. Parameter Naming

✅ **Use Clear Names:**
```
Node ID: 6
Parameter Name: text  ← Matches ComfyUI node input
```

❌ **Vague Names:**
```
Node ID: node_6
Parameter Name: param1  ← Unclear what it does
```

### 3. Timeout Settings

```
Simple workflows:      60-120 seconds
Complex workflows:     300-600 seconds
Video generation:      600-1800 seconds
```

### 4. Error Handling

```javascript
// Always validate inputs
if (!workflowJson) {
  throw new Error('Workflow JSON is required');
}

// Check ComfyUI server availability
// Use appropriate timeouts
// Handle network errors gracefully
```

---

## 🔧 Troubleshooting

### Common Issues

#### ❌ "Invalid ComfyUI URL"

**Solution:**
- Check ComfyUI is running
- Verify URL format: `http://127.0.0.1:8188`
- Try accessing ComfyUI in browser first

#### ❌ "Workflow execution timeout"

**Solutions:**
- Increase timeout value
- Check workflow complexity
- Verify ComfyUI server performance
- Check ComfyUI logs for errors

#### ❌ "Node ID not found in workflow"

**Solutions:**
- Open workflow JSON
- Find the correct node ID
- Note: IDs are strings like "6", "13", not numbers

#### ❌ "Failed to download image from URL"

**Solutions:**
- Verify URL is publicly accessible
- Check URL doesn't require authentication
- Ensure URL returns image (not HTML)
- Test URL in browser first

#### ❌ "AI Agent doesn't call ComfyUI"

**Solutions:**
- Ensure ComfyUI Tool is added to Agent's tools
- Check tool description is clear
- Verify workflow JSON is configured
- Check Agent logs

---

## 📖 Configuration Reference

### ComfyUI Tool Node

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **ComfyUI URL** | String | ✅ | `http://127.0.0.1:8188` | ComfyUI server address |
| **Workflow JSON** | String | ✅ | - | ComfyUI workflow in API format |
| **Timeout** | Number | ❌ | `300` | Max wait time (seconds) |
| **Load Image Node ID** | String | ❌ | - | LoadImage node ID for image workflows |
| **Image URL** | String | ❌ | - | URL of image to process |
| **Parameter Overrides** | Collection | ❌ | - | Override workflow parameters |

### ComfyUI Node

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **ComfyUI URL** | String | ✅ | `http://127.0.0.1:8188` | ComfyUI server address |
| **Workflow JSON** | String | ✅ | - | ComfyUI workflow in API format |
| **Timeout** | Number | ❌ | `300` | Max wait time (seconds) |
| **Output Binary Key** | String | ❌ | `data` | First output binary property name |
| **Node Parameters** | Collection | ❌ | - | Override workflow parameters |

### Node Parameter Fields

| Field | Description | Options |
|-------|-------------|---------|
| **Node ID** | Node ID from workflow JSON | e.g., `6`, `13`, `107` |
| **Parameter Mode** | How to configure parameters | Single / Multiple |
| **Type** | Parameter data type | Text / Number / Boolean / Image |
| **Image Input Type** | How to input image (when Type=Image) | Binary / URL |
| **Parameter Name** | Parameter to override (single mode) | e.g., `text`, `seed`, `steps` |
| **Parameters JSON** | JSON object with parameters (multiple mode) | `{"width": 1024}` |
| **Value** | Value to set | Text / Number / Boolean |

---

## 💡 Tips

### 🎯 Performance

- Start with simple workflows to test setup
- Use appropriate timeout values
- Monitor ComfyUI resource usage
- Use specific prompts for better results

### 🔒 Security

- Don't expose ComfyUI server publicly
- Use secure URLs for images
- Validate user inputs in production
- Keep workflow JSON private if needed

### 📝 Workflow Design

- Document your ComfyUI workflows
- Use consistent node IDs
- Test workflows in ComfyUI first
- Keep workflows simple and modular

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) - Powerful UI for Stable Diffusion
- [n8n](https://n8n.io) - Workflow automation tool

---

**Need Help?**

- 📖 Check the [Documentation](https://docs.n8n.io)
- 💬 Join the [Community](https://community.n8n.io)
- 🐛 Report [Issues](https://github.com/your-repo/issues)

**Happy Automating! 🚀**
