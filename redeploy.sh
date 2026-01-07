#!/bin/bash

# ComfyUI 节点一键部署脚本
# 使用方法: ./redeploy.sh

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}ComfyUI 节点一键部署${NC}"
echo -e "${YELLOW}========================================${NC}"

# 获取脚本所在目录和项目根目录
# 脚本位置: n8n-service/custom-nodes/n8n-comfyui-nodes/redeploy.sh
# 需要向上两级到达 n8n-service/
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(cd "$(dirname "$SCRIPT_DIR")/.." && pwd)"

echo -e "\n${GREEN}1️⃣  停止 n8n 服务...${NC}"
cd "$PROJECT_DIR"
bash ./stop-n8n.sh
sleep 2

echo -e "\n${GREEN}2️⃣  清理旧文件...${NC}"
rm -rf .n8n/nodes/node_modules/n8n-nodes-comfyui-all
rm -rf custom-nodes/n8n-comfyui-nodes/dist
rm -f custom-nodes/n8n-comfyui-nodes/*.tgz
echo -e "${GREEN}✓ 清理完成${NC}"

echo -e "\n${GREEN}3️⃣  编译项目...${NC}"
cd custom-nodes/n8n-comfyui-nodes
npm run build
echo -e "${GREEN}✓ 编译完成${NC}"

echo -e "\n${GREEN}4️⃣  打包节点...${NC}"
npm pack
echo -e "${GREEN}✓ 打包完成${NC}"

echo -e "\n${GREEN}5️⃣  安装节点...${NC}"
cd ../../.n8n/nodes
npm install /home/ZLQyiA/projets/n8n-service/custom-nodes/n8n-comfyui-nodes/n8n-nodes-comfyui-all-*.tgz
echo -e "${GREEN}✓ 安装完成${NC}"

echo -e "\n${GREEN}6️⃣  启动 n8n 服务...${NC}"
cd ../..
bash ./start-n8n.sh
echo -e "${GREEN}✓ n8n 已启动${NC}"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n访问 n8n: ${YELLOW}http://127.0.0.1:5678${NC}"
echo -e "建议按 ${YELLOW}Ctrl+Shift+R${NC} 强制刷新浏览器\n"
