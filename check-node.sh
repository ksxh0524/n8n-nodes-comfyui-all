#!/bin/bash
# 节点检查脚本

echo "=== ComfyUI 节点检查 ==="
echo ""

echo "1. 检查源文件..."
if [ -f "nodes/ComfyUi/ComfyUi.node.ts" ]; then
    echo "   ✓ 源节点文件存在"
else
    echo "   ✗ 源节点文件不存在"
    exit 1
fi

echo ""
echo "2. 检查图标文件..."
if [ -f "nodes/ComfyUi/comfyui.svg" ]; then
    SIZE=$(wc -c < nodes/ComfyUi/comfyui.svg)
    echo "   ✓ 图标文件存在 (${SIZE} 字节)"
else
    echo "   ✗ 图标文件不存在"
    exit 1
fi

echo ""
echo "3. 检查编译文件..."
if [ -f "dist/nodes/ComfyUi/ComfyUi.node.js" ]; then
    echo "   ✓ 编译后的节点文件存在"
else
    echo "   ✗ 编译后的节点文件不存在"
    exit 1
fi

if [ -f "dist/nodes/ComfyUi/comfyui.svg" ]; then
    echo "   ✓ 编译目录中的图标文件存在"
else
    echo "   ✗ 编译目录中的图标文件不存在"
    exit 1
fi

echo ""
echo "4. 检查 npm 链接..."
LINK_TARGET=$(readlink -f ~/.n8n/custom/node_modules/n8n-nodes-comfyui-all 2>/dev/null)
if [ "$LINK_TARGET" = "$(pwd)" ]; then
    echo "   ✓ npm 链接正确"
    echo "     链接目标: $LINK_TARGET"
else
    echo "   ✗ npm 链接不正确"
    echo "     当前: $LINK_TARGET"
    echo "     期望: $(pwd)"
fi

echo ""
echo "5. 检查 n8n 能否访问图标..."
if [ -f "$HOME/.n8n/custom/node_modules/n8n-nodes-comfyui-all/dist/nodes/ComfyUi/comfyui.svg" ]; then
    echo "   ✓ n8n 可以访问图标文件"
else
    echo "   ✗ n8n 无法访问图标文件"
fi

echo ""
echo "6. 检查图标内容..."
FIRST_LINE=$(head -1 nodes/ComfyUi/comfyui.svg)
if [[ "$FIRST_LINE" == *"<svg"* ]]; then
    echo "   ✓ 图标文件格式正确"
    echo "     $FIRST_LINE"
else
    echo "   ✗ 图标文件格式可能不正确"
fi

echo ""
echo "7. 检查节点配置..."
grep -q "icon: 'file:comfyui.svg'" nodes/ComfyUi/ComfyUi.node.ts
if [ $? -eq 0 ]; then
    echo "   ✓ 节点配置中包含图标引用"
else
    echo "   ✗ 节点配置中缺少图标引用"
fi

echo ""
echo "=== 检查完成 ==="
