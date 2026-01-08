# n8n-nodes-comfyui-all

> n8n community node for integrating ComfyUI workflows into n8n automation platform.

[![npm version](https://badge.fury.io/js/n8n-nodes-comfyui-all.svg)](https://www.npmjs.com/package/n8n-nodes-comfyui-all)

## ✨ Features

- 🎨 **Universal Workflow Support** - Works with any ComfyUI workflow in API format
- 🔄 **Dynamic Parameters** - Override workflow parameters dynamically
- 🎬 **Multi-Modal Support** - Supports images and videos for both input and output
- 🤖 **AI Agent Ready** - Two specialized nodes for different use cases:
  - **ComfyUI Tool** - Optimized for AI Agent workflows (URL-based image input)
  - **ComfyUI** - Full-featured node for standard workflows (binary & URL support)
- 📊 **Flexible Configuration** - JSON mode or single parameter mode
- 🔗 **Multiple Image Input Methods** - URL, binary data
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

## 📚 Nodes Overview

This package provides two specialized nodes for different use cases:

### 1. ComfyUI Tool Node 🤖

**Designed for: AI Agent Workflows**

- **Image Input**: URL only (prevents LLM context overflow)
- **Use Case**: When called by AI Agent as a tool
- **Advantages**:
  - Lightweight - URLs are short and don't bloat LLM context
  - Simple - No complex binary handling needed
  - Efficient - Automatic download and upload to ComfyUI

**Configuration:**
```
ComfyUI URL: http://127.0.0.1:8188
Workflow JSON: [Your ComfyUI workflow]
Load Image Node ID: 107
Image URL: https://example.com/image.png  ← URL only!
```

**Example for AI Agents:**
```javascript
// AI Agent passes:
{
  "imageUrl": "https://example.com/input.png",
  "prompt": "Transform this image to oil painting style"
}
```

### 2. ComfyUI Node 🔧

**Designed for: Standard Workflows**

- **Image Input**: Binary data OR URL
- **Use Case**: Regular n8n workflows with binary data flow
- **Advantages**:
  - Flexible - Supports both binary and URL inputs
  - Powerful - Full parameter override capabilities
  - Compatible - Works with n8n's binary data system

**Configuration:**
```
ComfyUI URL: http://127.0.0.1:8188
Workflow JSON: [Your ComfyUI workflow]

Node Parameters:
  Option 1 - Binary Mode:
    Type: Image
    Image Input Type: Binary
    Value: data

  Option 2 - URL Mode:
    Type: Image
    Image Input Type: URL
    Image URL: https://example.com/image.png
```

### Which Node Should I Use?

| Scenario | Use Node | Image Input | Example |
|----------|----------|-------------|---------|
| **AI Agent calling ComfyUI** | ComfyUI Tool | URL | `imageUrl: "https://..."` |
| **Chat Interface with images** | ComfyUI Tool | URL | User uploads image → gets URL |
| **Standard workflow** | ComfyUI | Binary or URL | HTTP Request → Binary → ComfyUI |
| **File processing workflow** | ComfyUI | Binary | Read Binary File → ComfyUI |
| **Webhook with images** | ComfyUI | Binary | Webhook → ComfyUI |

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

### Using ComfyUI Tool with AI Agents

The **ComfyUI Tool** node is specifically optimized for AI Agent workflows.

#### Why URL-Based Input?

AI Agents work best with **URL-based image input** because:
- ✅ **Prevents Context Overflow** - URLs are short, unlike base64 strings (can be 100x-1000x smaller)
- ✅ **Faster Processing** - Less data to pass to the LLM
- ✅ **Better Performance** - Reduces token usage and costs

#### Quick Setup

**Step 1: Create AI Agent**
1. Add **OpenAI Conversational Agent** node
2. Configure Chat Model (GPT-4/GPT-3.5)
3. Add Memory (optional but recommended)

**Step 2: Add ComfyUI Tool**
1. Click AI Agent node
2. In **Tools** section, click **+ Add Tool**
3. Search and select **ComfyUI Tool**
4. Configure:
   - **ComfyUI URL**: `http://127.0.0.1:8188`
   - **Workflow JSON**: Your ComfyUI workflow (API format)
   - **Load Image Node ID**: Your LoadImage node ID (e.g., `107`)
   - **Image URL**: `{{ $json.imageUrl }}` (dynamic from chat input)

**Step 3: Start Chatting**
Execute workflow and start conversing!

#### Example Conversations

**Basic Image Generation:**

**User:**
```
Generate a picture of a cute cat sitting on a fence
```

**AI:**
```
I'll generate that for you.
[Executes ComfyUI with prompt: "a cute cat sitting on a fence"]
Done! Here's the image.
```

**With Parameters:**

**User:**
```
Create a cyberpunk city, size:1024x768, steps:30
```

**Supported Parameters:**
- `size:WIDTHxHEIGHT` - Image dimensions
- `steps:N` - Sampling steps
- `cfg:N` - CFG strength
- `seed:N` - Random seed
- `negative:TEXT` - Negative prompt

**Negative Prompts:**

**User:**
```
Draw a beautiful sunset, negative: blurry, low quality
```

### Configuring Node Parameters for AI Agent

In the ComfyUI node, configure parameter overrides:

- **Node ID**: `6` (your CLIP text node)
- **Parameter Mode**: Single Parameter
- **Parameter Name**: `text`
- **Type**: Text
- **Value**: [Leave empty - AI Agent will fill this]

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

### Best Practices

**1. Clear Prompts**

**Good:** "Generate a landscape painting of mountains at sunset"

**Bad:** "Make a picture"

**2. Use Specific Parameters**

**Good:** "Create a portrait, size:512x768, steps:25"

**Bad:** "Create a high-quality portrait"

**3. Negative Prompts**

Always use negative prompts for better quality:

```
A beautiful landscape, negative: blurry, distorted, low quality
```

### Advanced Usage

#### Image Processing with ComfyUI Tool

**Image Editing with AI Agent:**

**User:**
```
Transform this image (https://example.com/photo.png) to oil painting style
```

**Workflow:**
1. User provides image URL in chat
2. AI Agent extracts URL
3. Calls **ComfyUI Tool** with:
   - `imageUrl`: `https://example.com/photo.png`
   - Parameter override for style prompt
4. ComfyUI Tool downloads image and processes it
5. Returns result to user

**Style Transfer Workflow:**

```
[Chat Input] → [AI Agent] → [ComfyUI Tool]
                          ↓
                    Downloads image from URL
                          ↓
                    Uploads to ComfyUI
                          ↓
                    Processes workflow
                          ↓
                    Returns result
```

**Multi-Modal Workflows:**

**User:**
```
Generate an image of a futuristic city, then write a poem about it
```

AI Agent:
1. Calls ComfyUI Tool to generate image
2. Calls Chat Model to write poem
3. Returns both results

#### Best Practices for URL Input

**1. Use Publicly Accessible URLs**

✅ **Good:**
```
https://cdn.example.com/images/photo.png
https://storage.googleapis.com/bucket/image.jpg
```

❌ **Bad:**
```
file:///local/path/image.png  ← Local files won't work
http://localhost:8080/image.png  ← Private URLs
```

**2. Ensure URLs Are Persistent**

Make sure the image URLs remain accessible during the workflow execution.

**3. Handle Large Images**

For large images (>10MB), consider:
- Using image optimization before passing URL
- Increasing timeout setting in ComfyUI Tool node

### Troubleshooting

**AI Agent Doesn't Call ComfyUI**

**Check:**
1. ComfyUI tool added to Tools list?
2. Workflow JSON configured?
3. ComfyUI server running?

**Images Don't Match Prompts**

**Check:**
1. Correct node ID (e.g., `6` for CLIP text)
2. Parameter name matches workflow (`text`)
3. Workflow uses dynamic text input

## 🔧 Configuration Reference

### ComfyUI Tool Node Configuration

| Field | Description | Example |
|-------|-------------|---------|
| **ComfyUI URL** | URL of your ComfyUI server | `http://127.0.0.1:8188` |
| **Workflow JSON** | ComfyUI workflow in API format | `{ "3": { "inputs": {...}, "class_type": "KSampler" } }` |
| **Timeout** | Maximum wait time in seconds | `300` (5 minutes) |
| **Load Image Node ID** | Node ID of LoadImage node for image input workflows | `107` |
| **Image URL** | URL of image to process (for AI Agent) | `https://example.com/image.png` |
| **Parameter Overrides** | Override specific workflow parameters | See below |

### ComfyUI Node Configuration

| Field | Description | Example |
|-------|-------------|---------|
| **ComfyUI URL** | URL of your ComfyUI server | `http://127.0.0.1:8188` |
| **Workflow JSON** | ComfyUI workflow in API format | `{ "3": { "inputs": {...}, "class_type": "KSampler" } }` |
| **Timeout** | Maximum wait time in seconds | `300` (5 minutes) |
| **Output Binary Key** | Property name for first output binary data | `data` |
| **Node Parameters** | Override workflow parameters | See below |

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