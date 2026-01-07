# Custom Deployment Guide

Guide for deploying this custom node in a development environment.

## ⚠️ Important Note

This guide is for **custom/local development deployment**. For production use, install from npm:

```bash
npm install n8n-nodes-comfyui-all
```

## 📋 Prerequisites

- Node.js 18.10+
- npm
- n8n instance
- ComfyUI server running

## 🚀 Quick Deployment

### One-Step Deployment (If you have the script)

```bash
cd /path/to/n8n-nodes-comfyui
./redeploy.sh
```

This script:
1. Stops n8n
2. Cleans old files
3. Builds the project
4. Packs the node
5. Installs to n8n
6. Restarts n8n

## 📦 Manual Deployment

### Step 1: Build the Project

```bash
cd /path/to/n8n-nodes-comfyui
npm install
npm run build
```

### Step 2: Pack the Node

```bash
npm pack
# Creates: n8n-nodes-comfyui-all-2.0.0.tgz
```

### Step 3: Install to n8n

```bash
# Navigate to n8n nodes directory
cd /path/to/n8n/.n8n/nodes

# Install the packed node
npm install /path/to/n8n-nodes-comfyui/n8n-nodes-comfyui-all-*.tgz
```

### Step 4: Restart n8n

```bash
cd /path/to/n8n
./stop-n8n.sh
./start-n8n.sh
```

Or use systemd:

```bash
sudo systemctl restart n8n
```

### Step 5: Verify Installation

1. Open n8n in browser
2. Press `Ctrl+Shift+R` to hard refresh
3. Add a new node
4. Search for "ComfyUI"
5. Verify the node appears

## 🔄 Redeployment After Code Changes

### Quick Redeploy

```bash
cd /path/to/n8n-nodes-comfyui
./redeploy.sh
```

### Manual Redeploy

```bash
# 1. Clean old files
cd /path/to/n8n
rm -rf .n8n/nodes/node_modules/n8n-nodes-comfyui-all

# 2. Build and pack
cd /path/to/n8n-nodes-comfyui
npm run build
npm pack

# 3. Reinstall
cd /path/to/n8n/.n8n/nodes
npm install /path/to/n8n-nodes-comfyui/n8n-nodes-comfyui-all-*.tgz

# 4. Restart n8n
cd /path/to/n8n
./stop-n8n.sh
./start-n8n.sh
```

## 🔧 Troubleshooting Deployment

### Node Not Appearing

**Check 1: Verify Installation**
```bash
ls -la /path/to/n8n/.n8n/nodes/node_modules/ | grep comfyui
```

Should show: `n8n-nodes-comfyui-all`

**Check 2: Verify Build**
```bash
cd /path/to/n8n-nodes-comfyui
ls -la dist/nodes/ComfyUi/
```

Should show: `ComfyUi.node.js`

**Check 3: Check n8n Logs**
```bash
tail -50 /path/to/n8n/n8n.log
```

Look for errors loading the node.

### Module Not Found Errors

If you see `Cannot find module '../ComfyUiClient'`:

This means you're using the old installation method. The new method uses npm pack:

```bash
# Clean up old installation
rm -rf /path/to/n8n/.n8n/custom/nodes/ComfyUi

# Use new deployment method
cd /path/to/n8n-nodes-comfyui
./redeploy.sh
```

### Duplicate Nodes

If you see two ComfyUI nodes:

```bash
# Check both locations
ls -la /path/to/n8n/.n8n/custom/nodes/ComfyUi
ls -la /path/to/n8n/.n8n/nodes/node_modules/n8n-nodes-comfyui-all

# Remove custom directory (old method)
rm -rf /path/to/n8n/.n8n/custom/nodes/ComfyUi

# Restart n8n
cd /path/to/n8n
./stop-n8n.sh
./start-n8n.sh
```

## 📁 File Locations

### Development Environment

```
n8n-service/
├── .n8n/
│   ├── nodes/
│   │   └── node_modules/
│   │       └── n8n-nodes-comfyui-all/  ← Node installed here
│   └── custom/
└── custom-nodes/
    └── n8n-comfyui-nodes/              ← Source code here
        ├── nodes/
        ├── dist/
        └── package.json
```

### Environment Variables

```bash
# Allow local network access
export N8N_ALLOW_NODES_SELF_REFERRAL=true

# Custom user data directory
export N8N_USER_DATA_DIR=/path/to/n8n/.n8n
```

## 🧪 Testing Deployment

### 1. Check Node Loads

```bash
# In n8n UI, press Ctrl+Shift+R
# Add node → Search "ComfyUI"
# Should see "ComfyUI" node with icon
```

### 2. Test Basic Functionality

Create a simple workflow:
1. Add **ComfyUI** node
2. Set **ComfyUI URL**: `http://127.0.0.1:8188`
3. Paste a test workflow JSON
4. Execute workflow
5. Verify it works

### 3. Check Logs

```bash
tail -f /path/to/n8n/n8n.log
```

Look for:
- Node loaded successfully
- No errors on startup
- ComfyUI connection works

## 🚀 Production Deployment

For production, **DO NOT** use this custom deployment method. Instead:

### Option 1: Install from npm

```bash
cd ~/.n8n
npm install n8n-nodes-comfyui-all
```

### Option 2: Community Nodes Installation

1. In n8n UI: **Settings** → **Community Nodes**
2. Enter: `n8n-nodes-comfyui-all`
3. Click **Install**

## 📊 Deployment Script

The `redeploy.sh` script automates deployment:

```bash
#!/bin/bash
set -e

echo "🔄 Deploying ComfyUI nodes..."

# Stop n8n
cd /path/to/n8n
./stop-n8n.sh

# Clean old files
rm -rf .n8n/nodes/node_modules/n8n-nodes-comfyui-all
cd custom-nodes/n8n-comfyui-nodes
rm -rf dist *.tgz

# Build
npm run build

# Pack
npm pack

# Install
cd ../../.n8n/nodes
npm install /path/to/custom-nodes/n8n-comfyui-nodes/n8n-nodes-comfyui-all-*.tgz

# Restart n8n
cd ../..
./start-n8n.sh

echo "✅ Deployment complete!"
```

## 💡 Tips

1. **Use the script** - `redeploy.sh` is faster and less error-prone
2. **Keep source separate** - Don't edit files in `node_modules/`
3. **Test after deployment** - Always verify the node works
4. **Check logs first** - When troubleshooting, check logs before making changes

## 📚 Related Documentation

- **[README](README.md)** - User documentation
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Developer guide
- **[AI-AGENT-USAGE.md](AI-AGENT-USAGE.md)** - AI Agent usage

## 🆘 Still Having Issues?

1. Check n8n logs: `tail -50 /path/to/n8n/n8n.log`
2. Verify ComfyUI is running: `curl http://127.0.0.1:8188/system_stats`
3. Try hard refresh: `Ctrl+Shift+R` in browser
4. Open a [GitHub Issue](https://github.com/wwrs/n8n-nodes-comfyui/issues)

Good luck! 🚀
