# n8n-nodes-comfyui-all

> n8n community node for integrating ComfyUI workflows into n8n automation platform.

[![npm version](https://badge.fury.io/js/n8n-nodes-comfyui-all.svg)](https://www.npmjs.com/package/n8n-nodes-comfyui-all)

## ✨ Features

- 🎨 **Universal Workflow Support** - Works with any ComfyUI workflow in API format
- 🔄 **Dynamic Parameters** - Override workflow parameters dynamically
- 🎬 **Multi-Modal Support** - Supports images and videos for both input and output
- 🤖 **AI Agent Ready** - Can be used as a tool in AI Agent workflows
- 📊 **Flexible Configuration** - JSON mode or single parameter mode
- 🔗 **URL Image Support** - Load images from URLs or binary data
- 🏷️ **Customizable Output** - Customize binary output property names

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

> Restart n8n after installation.

## 🚀 Quick Start

### 1. Prerequisites

- ComfyUI server running (default: `http://127.0.0.1:8188`)
- n8n instance (version 2.x or higher)

### 2. Create Your Workflow in ComfyUI

1. Design your workflow in ComfyUI
2. Click **Save (API Format)** to export
3. Copy the generated JSON

### 3. Configure n8n Node

1. Add **ComfyUI** node to your n8n workflow
2. Set **ComfyUI URL**: `http://127.0.0.1:8188`
3. Paste your **Workflow JSON**
4. Optionally configure **Node Parameters**

## 📖 Usage

### Basic Example: Text to Image

**Node Configuration:**
- **ComfyUI URL**: `http://127.0.0.1:8188`
- **Workflow JSON**: Your ComfyUI workflow in API format

**Optional Node Parameters (Single Parameter Mode):**
- Node ID: `6` (your CLIP text node)
- Parameter Name: `text`
- Type: `Text`
- Value: `a beautiful landscape, high quality`

### Parameter Configuration Modes

#### 1. Multiple Parameters Mode (JSON)

Configure multiple parameters at once using JSON:

```json
{
  "width": 1024,
  "height": 1024,
  "batch_size": 1,
  "seed": 12345
}
```

#### 2. Single Parameter Mode

Configure one parameter at a time with type validation:

- **Parameter Name**: `steps`
- **Type**: `Number`
- **Value**: `25`

### Image Input Options

The node supports two methods for uploading images to ComfyUI:

#### Method 1: Binary Data

Upload images from n8n binary data:

- **Type**: `Image`
- **Image Input Type**: `Binary`
- **Value**: Binary property name (e.g., `data`, `image`, `file`)

#### Method 2: URL

Download and upload images from a URL:

- **Type**: `Image`
- **Image Input Type**: `URL`
- **Image URL**: Full URL of the image (e.g., `https://example.com/image.png`)

The node will automatically download the image from the URL and upload it to ComfyUI.

### Custom Output Binary Key

By default, the first output image/video uses `data` as the binary property name. You can customize this:

- **Output Binary Key**: Property name for the first output (e.g., `image`, `output`, `result`)
- Default: `data`

**Example:**
```json
{
  "binary": {
    "myImage": { "data": "...", "mimeType": "image/png" }
  }
}
```

## 🤖 AI Agent Integration

Use ComfyUI as a tool in AI Agent workflows:

1. Add an **AI Agent** node (e.g., OpenAI Conversational Agent)
2. In the **Tools** section, add **ComfyUI**
3. Configure the ComfyUI node parameters
4. Start chatting!

**Example:**
```
User: Generate a cute cat picture

AI: I'll generate that for you using ComfyUI.
    [Calls ComfyUI tool]
    Done! Here's your cute cat picture.
```

### Tool Mode Output Format

When used as an AI Agent tool, ComfyUI returns both binary data and URL information:

**Binary Output:**
- Images are returned as binary data (base64-encoded) in the `binary` object
- First image: `binary.data`
- Additional images: `binary.image_1`, `binary.image_2`, etc.
- Videos: `binary.video_0`, `binary.video_1`, etc.

**JSON Output (with URLs):**
- `json.images`: Array of image paths
- `json.imageUrls`: Array of complete image URLs (e.g., `http://127.0.0.1:8188/view?filename=...`)
- `json.videos`: Array of video paths
- `json.videoUrls`: Array of complete video URLs
- `json.imageCount`: Number of images generated
- `json.videoCount`: Number of videos generated

This ensures compatibility with both workflow mode (binary data) and tool mode (URLs for AI Agent).

For detailed AI Agent usage, see [AI-AGENT-USAGE.md](AI-AGENT-USAGE.md).

## 🔧 Configuration Reference

| Field | Description |
|-------|-------------|
| **ComfyUI URL** | URL of your ComfyUI server |
| **Workflow JSON** | ComfyUI workflow in API format |
| **Timeout** | Maximum wait time in seconds (default: 300) |
| **Output Binary Key** | Property name for first output binary data (default: `data`) |
| **Node Parameters** | Override workflow parameters |

#### Node Parameter Fields

| Field | Description |
|-------|-------------|
| **Node ID** | The node ID in your workflow (e.g., `6`, `13`) |
| **Parameter Mode** | Single Parameter or Multiple Parameters (JSON) |
| **Type** | Data type: Text, Number, Boolean, or Image |
| **Image Input Type** | (When Type=Image) Binary or URL |
| **Image URL** | (When Image Input Type=URL) URL to download image from |
| **Parameter Name** | (Single mode) Parameter name to override |
| **Parameters JSON** | (Multiple mode) JSON object with parameters |
| **Value** | Value to set (varies by Type) |

## 💡 Tips

- **First time**: Start with a simple text-to-image workflow
- **Parameter overrides**: Use Node Parameters instead of modifying workflow JSON
- **Seed control**: Fixed seeds produce reproducible results
- **Optimization**: 20-30 sampling steps are usually sufficient
- **Image input**: Use Image type with Binary source for n8n binary data, or URL source to download from web
- **Output naming**: Customize Output Binary Key to match your workflow's expected property names