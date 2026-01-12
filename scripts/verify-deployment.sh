#!/bin/bash

# 部署验证脚本 | Deployment Verification Script
# 用法: ./scripts/verify-deployment.sh

set -e

echo "🚀 开始部署验证..."
echo "═════════════════════════════════════════"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. 检查 dist 目录
echo ""
echo "📦 检查构建输出..."

if [ ! -d "dist" ]; then
    check_fail "dist 目录不存在，请先运行 'npm run build'"
fi
check_pass "dist 目录存在"

# 检查主入口文件
if [ ! -f "dist/index.js" ]; then
    check_fail "dist/index.js 不存在"
fi
check_pass "主入口文件存在"

# 检查节点文件
if [ ! -f "dist/nodes/ComfyUi/ComfyUi.node.js" ]; then
    check_fail "节点文件不存在"
fi
check_pass "节点文件存在"

# 检查图标文件
if [ ! -f "dist/nodes/ComfyUi/comfyui.svg" ]; then
    check_warn "图标文件缺失（可选）"
else
    check_pass "图标文件存在"
fi

# 检查新模块
if [ ! -f "dist/nodes/processors/ImageProcessor.js" ]; then
    check_warn "ImageProcessor 模块缺失"
else
    check_pass "ImageProcessor 模块存在"
fi

if [ ! -f "dist/nodes/executionModeDetector.js" ]; then
    check_warn "executionModeDetector 模块缺失"
else
    check_pass "executionModeDetector 模块存在"
fi

# 2. 检查 package.json 配置
echo ""
echo "📋 检查 package.json 配置..."

if grep -q '"main": "dist/index.js"' package.json; then
    check_pass "main 入口正确"
else
    check_fail "main 入口配置错误"
fi

if grep -q '"n8n-nodes-comfyui-all"' package.json; then
    check_pass "包名称正确"
else
    check_fail "包名称错误"
fi

if grep -q '"n8nNodesApiVersion": 1' package.json; then
    check_pass "n8n API 版本正确"
else
    check_fail "n8n API 版本配置错误"
fi

# 3. 验证入口点导出
echo ""
echo "🔍 验证入口点导出..."

if grep -q "exports.nodeClasses" dist/index.js; then
    check_pass "nodeClasses 导出正确"
else
    check_fail "nodeClasses 导出缺失"
fi

if grep -q "ComfyUi" dist/index.js; then
    check_pass "ComfyUi 节点已导出"
else
    check_fail "ComfyUi 节点未导出"
fi

# 4. 检查 ESLint
echo ""
echo "🎯 运行 ESLint 检查..."

if npm run lint > /dev/null 2>&1; then
    check_pass "ESLint 检查通过"
else
    check_fail "ESLint 检查失败，请运行 'npm run lint' 查看"
fi

# 5. 统计信息
echo ""
echo "📊 构建统计..."
DIST_SIZE=$(du -sh dist | cut -f1)
NODE_COUNT=$(find dist/nodes -name "*.node.js" | wc -l)
MODULE_COUNT=$(find dist/nodes -name "*.js" | wc -l)

echo "   dist 目录大小: $DIST_SIZE"
echo "   节点数量: $NODE_COUNT"
echo "   模块总数: $MODULE_COUNT"
check_pass "构建统计完成"

# 6. 文件完整性检查
echo ""
echo "📝 文件完整性检查..."

REQUIRED_FILES=(
    "dist/index.js"
    "dist/index.d.ts"
    "dist/nodes/ComfyUi/ComfyUi.node.js"
    "dist/nodes/ComfyUi/ComfyUi.node.d.ts"
    "dist/nodes/parameterProcessor.js"
    "dist/nodes/executionModeDetector.js"
    "dist/nodes/processors/ImageProcessor.js"
    "dist/nodes/processors/ParameterTypeHandler.js"
)

ALL_PRESENT=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ $file"
    else
        echo "   ✗ $file (缺失)"
        ALL_PRESENT=false
    fi
done

if [ "$ALL_PRESENT" = true ]; then
    check_pass "所有必需文件存在"
else
    check_fail "部分必需文件缺失"
fi

# 7. 版本信息
echo ""
echo "🏷️  版本信息..."
VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4)
echo "   当前版本: $VERSION"
check_pass "版本: $VERSION"

# 最终总结
echo ""
echo "═════════════════════════════════════════"
echo -e "${GREEN}🎉 部署验证通过！${NC}"
echo ""
echo "下一步操作:"
echo "  1. 发布到 npm: npm publish"
echo "  2. 或本地安装: cd ~/.n8n && npm install /path/to/this/dir"
echo "  3. 或从 git 安装: npm install https://github.com/ksxh0524/n8n-nodes-comfyui-all.git"
echo "═════════════════════════════════════════"
