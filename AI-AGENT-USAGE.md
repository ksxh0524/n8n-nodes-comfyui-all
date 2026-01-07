# AI Agent Usage Guide

Complete guide for using ComfyUI node as a tool in AI Agent workflows.

## 🚀 Quick Setup

### Step 1: Create AI Agent

1. Add **OpenAI Conversational Agent** node
2. Configure Chat Model (GPT-4/GPT-3.5)
3. Add Memory (optional but recommended)

### Step 2: Add ComfyUI Tool

1. Click AI Agent node
2. In **Tools** section, click **+ Add Tool**
3. Search and select **ComfyUI**
4. Configure:
   - **ComfyUI URL**: `http://127.0.0.1:8188`
   - **Action**: TextToAny
   - **Workflow JSON**: Your ComfyUI workflow (API format)
   - **Node Parameters**: Configure text parameter override

### Step 3: Start Chatting

Execute workflow and start conversing!

## 💬 Example Conversations

### Basic Image Generation

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

### With Parameters

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

### Negative Prompts

**User:**
```
Draw a beautiful sunset, negative: blurry, low quality
```

## 🎨 Configuring Node Parameters for AI Agent

In the ComfyUI node, configure parameter overrides:

- **Node ID**: `6` (your CLIP text node)
- **Parameter Mode**: Single Parameter
- **Parameter Name**: `text`
- **Type**: Text
- **Value**: [Leave empty - AI Agent will fill this]

## 💡 Best Practices

### 1. Clear Prompts

**Good:** "Generate a landscape painting of mountains at sunset"

**Bad:** "Make a picture"

### 2. Use Specific Parameters

**Good:** "Create a portrait, size:512x768, steps:25"

**Bad:** "Create a high-quality portrait"

### 3. Negative Prompts

Always use negative prompts for better quality:

```
A beautiful landscape, negative: blurry, distorted, low quality
```

## 🔧 Advanced Usage

### Style Transfer

**User:**
```
Transform this image to oil painting style
```

Setup:
- Use **ImagesToAny** action
- Upload input image as binary data
- Configure style parameters

### Multi-Modal Workflows

Combine ComfyUI with other tools:

**User:**
```
Generate an image of a futuristic city, then write a poem about it
```

AI Agent:
1. Calls ComfyUI to generate image
2. Calls Chat Model to write poem
3. Returns both results

## 📊 Minimal Workflow Template

```json
{
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
}
```

**Node Parameter Configuration:**
- Node ID: `6`
- Parameter Name: `text`
- Type: Text
- Value: [Empty - filled by AI Agent]

## 🔍 Troubleshooting

### AI Agent Doesn't Call ComfyUI

**Check:**
1. ComfyUI tool added to Tools list?
2. Workflow JSON configured?
3. ComfyUI server running?

### Images Don't Match Prompts

**Check:**
1. Correct node ID (e.g., `6` for CLIP text)
2. Parameter name matches workflow (`text`)
3. Workflow uses dynamic text input

## 📚 Related Resources

- **[Main README](README.md)** - Basic node usage
- **[ComfyUI Documentation](https://docs.comfy.org/)** - ComfyUI official docs
- **[n8n AI Agent Guide](https://docs.n8n.io/ai-agents/)** - n8n AI Agent documentation

## 💻 Example n8n Workflow

```
┌─────────────┐
│ Chat Input  │
└──────┬──────┘
       │
       ▼
┌──────────────────────────┐
│  OpenAI Agent            │
│  ┌────────────────────┐  │
│  │ Tools:             │  │
│  │ ├─ ComfyUI        │  │
│  │ └─ [Others]       │  │
│  └────────────────────┘  │
└──────┬───────────────────┘
       │
       ▼
┌─────────────┐
│  ComfyUI    │
│  Node       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Output     │
│  Images     │
└─────────────┘
```

## 🎉 Conclusion

Using ComfyUI with AI Agent enables powerful natural language image generation. Experiment with different workflows and find what works best for you!

For more help, see the [main documentation](README.md).
