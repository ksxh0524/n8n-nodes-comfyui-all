# 部署指南 | Deployment Guide

## 版本信息 | Version Information

- **当前版本**: 2.4.15
- **最新提交**: f83dd965
- **构建日期**: 2026-01-12
- **n8n API 版本**: 1
- **Node.js 要求**: >= 18.0.0

---

## 部署检查清单 | Deployment Checklist

### 1. 构建验证 | Build Verification ✅

```bash
# 清理旧的构建
rm -rf dist/

# 运行完整构建
npm run build

# 验证构建输出
ls -la dist/
ls -la dist/nodes/
ls -la dist/nodes/ComfyUi/
```

**预期输出**:
```
dist/
├── index.js                 # 主入口文件
├── index.d.ts               # TypeScript 类型定义
├── nodes/
│   ├── ComfyUi/
│   │   ├── ComfyUi.node.js  # 节点实现
│   │   ├── ComfyUi.node.d.ts
│   │   └── comfyui.svg      # 节点图标
│   ├── processors/          # 新增：模块化处理器
│   │   ├── ImageProcessor.js
│   │   └── ParameterTypeHandler.js
│   ├── executionModeDetector.js  # 新增：模式检测
│   ├── parameterProcessor.js
│   └── [其他模块...]
```

### 2. 代码质量检查 | Code Quality Verification ✅

```bash
# TypeScript 编译
npm run build

# ESLint 检查
npm run lint

# 预期结果: 0 错误, 0 警告
```

### 3. 发布文件验证 | Package Files Verification ✅

**package.json 配置**:
```json
{
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./package.json": "./package.json"
  },
  "files": [
    "dist",
    "LICENSE",
    "README.md"
  ],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [],
    "nodes": [
      "dist/nodes/ComfyUi/ComfyUi.node.js"
    ]
  }
}
```

**检查命令**:
```bash
# 验证入口点
cat dist/index.js | grep "nodeClasses"

# 验证节点文件
test -f dist/nodes/ComfyUi/ComfyUi.node.js && echo "✅ 节点文件存在"
test -f dist/nodes/ComfyUi/comfyui.svg && echo "✅ 图标文件存在"
```

---

## 部署步骤 | Deployment Steps

### 选项 A: 发布到 NPM | Publish to NPM

```bash
# 1. 更新版本号（如需要）
npm version patch  # 2.4.15 -> 2.4.16
# 或
npm version minor  # 2.4.15 -> 2.5.0
# 或
npm version major  # 2.4.15 -> 3.0.0

# 2. 运行发布前检查
npm run prepublishOnly

# 3. 发布到 npm
npm publish

# 4. 验证发布
npm view n8n-nodes-comfyui-all
```

### 选项 B: 本地安装到 n8n | Local Installation

```bash
# 1. 进入 n8n 目录
cd ~/.n8n

# 2. 从本地路径安装
npm install /path/to/n8n-comfyui-nodes

# 3. 或使用相对路径
npm install ../n8n-comfyui-nodes

# 4. 重启 n8n
# n8n 会自动加载新节点
```

### 选项 C: 从 Git 安装 | Install from Git

```bash
# 在 n8n 目录中
cd ~/.n8n

# 从 GitHub 安装
npm install https://github.com/ksxh0524/n8n-nodes-comfyui-all.git

# 或从特定分支/提交
npm install https://github.com/ksxh0524/n8n-nodes-comfyui-all.git#master
```

### 选项 D: n8n Cloud 安装 | n8n Cloud Installation

1. 登录 n8n Cloud
2. 进入 **Settings** → **Community Nodes**
3. 点击 **Install**
4. 输入: `n8n-nodes-comfyui-all`
5. 点击 **Install**

---

## 验证部署 | Verify Deployment

### 1. 检查节点是否加载

在 n8n 中添加新节点时，应该能看到：
- **ComfyUI** 节点
- 图标: 🔴 (红色)
- 分类: Transform

### 2. 测试基本功能

创建一个简单的工作流测试：

```json
{
  "nodes": [
    {
      "name": "ComfyUI",
      "type": "n8n-nodes-base.comfyUi",
      "position": [250, 300],
      "parameters": {
        "comfyUiUrl": "http://127.0.0.1:8188",
        "workflowJson": "{ ... }"
      }
    }
  ]
}
```

### 3. 验证模式检测

检查日志输出中的执行模式：
```
📊 执行模式检测结果
═══════════════════════════════
🎯 最终决策: action
   原因: 默认 Action 模式（返回完整二进制数据）
   检测来源: default
   有二进制数据: 否
   有输入数据: 否
═══════════════════════════════
```

---

## 架构与代码质量 | Architecture & Code Quality

### 核心架构设计

节点采用智能模式检测架构：

```
ComfyUI Node
├── executionModeDetector.ts
│   ├── n8n API check (isToolExecution) - primary
│   ├── execution context check (getMode) - secondary
│   ├── AI Agent metadata markers - tertiary
│   ├── heuristic analysis - fallback
│   └── default to action mode
│
├── parameterProcessor.ts (coordinator)
│   ├── ImageProcessor (URL & binary handling)
│   └── ParameterTypeHandler (type conversions)
│
└── ComfyUi.node.ts
    ├── Execution Mode selection (Auto/Tool/Action)
    ├── Multi-layer detection
    ├── Intelligent warnings on conflicts
    ├── Route to tool/action logic
    └── Return appropriate output
```

### 执行模式 | Execution Modes

**Auto Detect** (默认):
- 自动检测最佳执行模式
- 多层检测策略
- 智能冲突警告

**Tool Mode** (AI Agent):
- 返回图片 URL
- 不支持 binary 输入
- 适合 AI Agent 调用

**Action Mode** (Standard Workflow):
- 返回完整二进制数据
- 支持 URL 和 binary 输入
- 适合标准工作流

### 智能警告系统

当检测到特征且与用户选择冲突时：
- 显示检测建议（模式、来源、置信度）
- 提示检查执行模式配置
- 帮助避免配置错误

### 代码质量指标 | Code Quality Metrics

| 指标 | 状态 |
|------|------|
| TypeScript 编译 | ✅ 通过 |
| ESLint 检查 | ✅ 0 错误 0 警告 |
| Non-null assertions | ✅ 0 处 |
| 类型验证 | ✅ 完整 |
| 模块化程度 | ✅ 高度模块化 |
| ES6 imports | ✅ 100% |
| 配置对象模式 | ✅ 采用 |
| 测试覆盖 | ✅ 已包含 |

### 代码统计 | Code Statistics

```
Language: TypeScript
Total Lines: ~3000+
Modules: 18
Main Node: ComfyUi.node.ts
Test Files: 2 (executionModeDetector, comfyUiClient)
```

### 最近改进 | Recent Enhancements

**Bug 修复** (Commit: 3891f1b1):
- ✅ 修复视频处理循环中的索引错误（移除有问题的 splice 操作）
- ✅ 添加 videoBuffer 空值检查，防止 `undefined` 错误
- ✅ Tool 模式和 Action 模式 UI 完全一致（移除参数显示限制）

**执行模式控制** (Commit: f83dd965):
- ✅ 添加 Execution Mode 参数（Auto/Tool/Action）
- ✅ 多层检测策略（5 层）
- ✅ 智能警告系统（任何检测到特征即警告）
- ✅ 检测结果始终显示（透明度）
- ✅ UI 文本优化（移除括号说明）

**模式检测增强**:
- ✅ n8n API 检查 (`isToolExecution()`)
- ✅ 执行上下文检查 (`getMode() === 'chat'`)
- ✅ AI Agent 元数据标记
- ✅ 启发式分析（强指标优先）
- ✅ 检测来源追踪

**代码质量**:
- ✅ ESLint v9 flat config
- ✅ 移除所有 non-null assertions
- ✅ 添加显式 null 检查
- ✅ 参数类型验证
- ✅ 代码格式化改进

---

## 故障排除 | Troubleshooting

### 节点未显示

```bash
# 检查节点文件是否正确编译
test -f dist/nodes/ComfyUi/ComfyUi.node.js || echo "❌ 节点文件缺失"

# 检查 n8n 配置
cat ~/.n8n/config | grep comfyui
```

### 模式检测问题

查看 n8n 日志：
```
grep "执行模式" ~/.n8n/logs/*.log
```

### 类型错误

```bash
# 重新构建
npm run build

# 检查 TypeScript 错误
npm run build 2>&1 | grep "error TS"
```

---

## 联系方式 | Contact

- **GitHub Issues**: https://github.com/ksxh0524/n8n-nodes-comfyui-all/issues
- **Email**: ksxh0524@outlook.com

---

## 许可证 | License

MIT License - 详见 LICENSE 文件
