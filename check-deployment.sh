#!/bin/bash

echo "=================================="
echo "ComfyUI 节点部署检查"
echo "=================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查编译文件
echo "1️⃣  检查编译文件..."
if [ -f "/home/ZLQyiA/projets/n8n-service/n8n-comfyui-nodes/dist/nodes/ComfyUi/ComfyUi.node.js" ]; then
    echo -e "${GREEN}✓${NC} 编译文件存在"
    ls -lh /home/ZLQyiA/projets/n8n-service/n8n-comfyui-nodes/dist/nodes/ComfyUi/ComfyUi.node.js
else
    echo -e "${RED}✗${NC} 编译文件不存在"
fi
echo ""

# 2. 检查 custom 目录安装
echo "2️⃣  检查 custom 目录安装..."
if [ -L "/home/ZLQyiA/projets/n8n-service/.n8n/custom/node_modules/n8n-nodes-comfyui-all" ]; then
    echo -e "${GREEN}✓${NC} 符号链接存在"
    echo "   链接目标: $(readlink -f /home/ZLQyiA/projets/n8n-service/.n8n/custom/node_modules/n8n-nodes-comfyui-all)"
else
    echo -e "${RED}✗${NC} 符号链接不存在"
fi
echo ""

# 3. 检查 package.json
echo "3️⃣  检查 package.json 配置..."
if grep -q "n8n-nodes-comfyui-all" /home/ZLQyiA/projets/n8n-service/.n8n/custom/package.json 2>/dev/null; then
    echo -e "${GREEN}✓${NC} package.json 包含 ComfyUI 节点依赖"
else
    echo -e "${YELLOW}⚠${NC} package.json 未找到或不包含 ComfyUI 节点"
fi
echo ""

# 4. 检查 n8n 服务状态
echo "4️⃣  检查 n8n 服务状态..."
if pgrep -f "n8n start" > /dev/null; then
    echo -e "${GREEN}✓${NC} n8n 服务正在运行"
    echo "   PID: $(pgrep -f 'n8n start' | head -1)"
    echo "   端口: 5678"
else
    echo -e "${RED}✗${NC} n8n 服务未运行"
fi
echo ""

# 5. 检查 n8n 日志
echo "5️⃣  检查最近的 n8n 日志..."
if [ -f "/home/ZLQyiA/projets/n8n-service/n8n.log" ]; then
    echo -e "${GREEN}✓${NC} 日志文件存在"
    echo "   最新日志（最后 10 行）："
    echo "   ----------------------------------------"
    tail -n 10 /home/ZLQyiA/projets/n8n-service/n8n.log | sed 's/^/   /'
    echo "   ----------------------------------------"
else
    echo -e "${YELLOW}⚠${NC} 日志文件未找到"
fi
echo ""

# 6. 检查 ComfyUI 服务
echo "6️⃣  检查 ComfyUI 服务..."
if curl -s http://127.0.0.1:8188/system_stats > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} ComfyUI 服务正在运行"
    echo "   URL: http://127.0.0.1:8188"
else
    echo -e "${YELLOW}⚠${NC} ComfyUI 服务未运行或无法访问"
    echo "   请确保 ComfyUI 运行在 http://127.0.0.1:8188"
fi
echo ""

# 7. 文件结构总结
echo "7️⃣  文件结构总结..."
echo "   项目目录:"
echo "   ├── n8n-comfyui-nodes/          (源代码)"
echo "   │   ├── dist/                   (编译输出)"
echo "   │   ├── nodes/                  (节点定义)"
echo "   │   ├── agent-tools/            (AI Agent 工具)"
echo "   │   └── package.json"
echo "   └── .n8n/custom/                (n8n 自定义节点目录)"
echo "       ├── node_modules/"
echo "       │   └── n8n-nodes-comfyui-all -> ../../../n8n-comfyui-nodes"
echo "       └── package.json"
echo ""

# 8. 快速测试建议
echo "8️⃣  快速测试建议..."
echo "   1. 访问 n8n 界面: ${GREEN}http://127.0.0.1:5678${NC}"
echo "   2. 创建新工作流"
echo "   3. 添加节点，搜索 ${YELLOW}\"ComfyUI Workflow\"${NC}"
echo "   4. 如果能看到节点，说明安装成功！"
echo ""

# 9. AI Agent 工具设置
echo "9️⃣  AI Agent 工具设置..."
echo "   要在 AI Agent 中使用 ComfyUI："
echo "   1. 添加 Custom Code Tool 节点"
echo "   2. Description: \"Generates images using ComfyUI\""
echo "   3. 复制代码: agent-tools/ComfyUI-Agent-Tool.js"
echo "   4. 添加到 AI Agent 的 Tools 列表"
echo ""

echo "=================================="
echo "检查完成！"
echo "=================================="
