# 贡献指南 & 开发文档

感谢您对本项目的关注！我们欢迎各种形式的贡献。

## 目录

- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [构建命令](#构建命令)
- [本地测试](#本地测试)
- [本地部署](#本地部署)
- [代码规范](#代码规范)
- [提交更改](#提交更改)
- [编码标准](#编码标准)
- [安全考虑](#安全考虑)
- [问题反馈](#问题反馈)
- [发布到 npm](#发布到-npm)

## 开发环境设置

### 前置要求

- Node.js 18.10+
- npm 或 yarn
- TypeScript 5.x
- Git

### 1. Fork 仓库

点击仓库页面右上角的 "Fork" 按钮。

### 2. 克隆您的 Fork

```bash
git clone https://github.com/YOUR_USERNAME/n8n-nodes-comfyui-all.git
cd n8n-nodes-comfyui-all
```

### 3. 安装依赖

```bash
npm install
```

### 4. 开始开发

```bash
npm run dev
```

这将启动 TypeScript 监视模式，自动重新编译更改。

## 项目结构

```
n8n-nodes-comfyui-all/
├── nodes/
│   ├── ComfyUi/
│   │   ├── ComfyUi.node.ts     # 主节点实现
│   │   └── comfyui.svg          # 节点图标
│   ├── ComfyUiTool/
│   │   ├── ComfyUiTool.node.ts # AI Agent 工具节点
│   │   └── comfyuitool.svg
│   ├── ComfyUiClient.ts         # ComfyUI API 客户端
│   ├── constants.ts             # 配置常量
│   ├── logger.ts                # 日志工具
│   ├── types.ts                 # TypeScript 类型定义
│   ├── validation.ts            # 输入验证
│   ├── errors.ts                # 错误消息
│   └── cache.ts                 # 缓存层
├── dist/                        # 编译输出
├── test/                        # 测试文件
├── index.ts                     # 包入口
├── package.json                 # 包配置
├── tsconfig.json               # TypeScript 配置
├── README.md                   # 用户文档
└── CONTRIBUTING.md             # 本文档
```

## 构建命令

### 编译 TypeScript

```bash
npm run build
```

### 监视模式（开发）

```bash
npm run dev
```

文件更改时自动重新编译。

### 代码检查

```bash
# 检查代码风格
npm run lint

# 自动修复问题
npm run lintfix

# 格式化代码
npm run format
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 本地测试

### 方法 1: 符号链接（推荐用于开发）

```bash
# 在 n8n 自定义目录中
cd ~/.n8n/custom
npm link /path/to/n8n-nodes-comfyui

# 重启 n8n
```

### 方法 2: 本地包

```bash
# 构建包
cd /path/to/n8n-nodes-comfyui
npm run build
npm pack

# 安装到 n8n
cd ~/.n8n/custom
npm install /path/to/n8n-nodes-comfyui/n8n-nodes-comfyui-all-*.tgz

# 重启 n8n
```

## 本地部署

> **注意**: 本节适用于**自定义/本地开发部署**。生产环境请从 npm 安装：
> ```bash
> npm install n8n-nodes-comfyui-all
> ```

### 快速部署

**一键部署（如果有脚本）**

```bash
cd /path/to/n8n-nodes-comfyui
./redeploy.sh
```

该脚本会：
1. 停止 n8n
2. 清理旧文件
3. 构建项目
4. 打包节点
5. 安装到 n8n
6. 重启 n8n

### 手动部署

**步骤 1: 构建项目**

```bash
cd /path/to/n8n-nodes-comfyui
npm install
npm run build
```

**步骤 2: 打包节点**

```bash
npm pack
# 创建: n8n-nodes-comfyui-all-2.0.0.tgz
```

**步骤 3: 安装到 n8n**

```bash
# 导航到 n8n 节点目录
cd /path/to/n8n/.n8n/nodes

# 安装打包的节点
npm install /path/to/n8n-nodes-comfyui/n8n-nodes-comfyui-all-*.tgz
```

**步骤 4: 重启 n8n**

```bash
cd /path/to/n8n
./stop-n8n.sh
./start-n8n.sh
```

或使用 systemd：

```bash
sudo systemctl restart n8n
```

**步骤 5: 验证安装**

1. 在浏览器中打开 n8n
2. 按 `Ctrl+Shift+R` 硬刷新
3. 添加新节点
4. 搜索 "ComfyUI"
5. 验证节点出现

### 代码更改后重新部署

**快速重新部署**

```bash
cd /path/to/n8n-nodes-comfyui
./redeploy.sh
```

**手动重新部署**

```bash
# 1. 清理旧文件
cd /path/to/n8n
rm -rf .n8n/nodes/node_modules/n8n-nodes-comfyui-all

# 2. 构建和打包
cd /path/to/n8n-nodes-comfyui
npm run build
npm pack

# 3. 重新安装
cd /path/to/n8n/.n8n/nodes
npm install /path/to/n8n-nodes-comfyui/n8n-nodes-comfyui-all-*.tgz

# 4. 重启 n8n
cd /path/to/n8n
./stop-n8n.sh
./start-n8n.sh
```

### 部署故障排除

**节点不出现**

**检查 1: 验证安装**
```bash
ls -la /path/to/n8n/.n8n/nodes/node_modules/ | grep comfyui
```

应该显示: `n8n-nodes-comfyui-all`

**检查 2: 验证构建**
```bash
cd /path/to/n8n-nodes-comfyui
ls -la dist/nodes/ComfyUi/
```

应该显示: `ComfyUi.node.js`

**检查 3: 检查 n8n 日志**
```bash
tail -50 /path/to/n8n/n8n.log
```

查找加载节点的错误。

**模块未找到错误**

如果看到 `Cannot find module '../ComfyUiClient'`：

这意味着您正在使用旧的安装方法。新方法使用 npm pack：

```bash
# 清理旧安装
rm -rf /path/to/n8n/.n8n/custom/nodes/ComfyUi

# 使用新的部署方法
cd /path/to/n8n-nodes-comfyui
./redeploy.sh
```

**重复节点**

如果看到两个 ComfyUI 节点：

```bash
# 检查两个位置
ls -la /path/to/n8n/.n8n/custom/nodes/ComfyUi
ls -la /path/to/n8n/.n8n/nodes/node_modules/n8n-nodes-comfyui-all

# 删除 custom 目录（旧方法）
rm -rf /path/to/n8n/.n8n/custom/nodes/ComfyUi

# 重启 n8n
cd /path/to/n8n
./stop-n8n.sh
./start-n8n.sh
```

### 测试部署

**1. 检查节点加载**

```bash
# 在 n8n UI 中，按 Ctrl+Shift+R
# 添加节点 → 搜索 "ComfyUI"
# 应该看到带图标的 "ComfyUI" 节点
```

**2. 测试基本功能**

创建简单工作流：
1. 添加 **ComfyUI** 节点
2. 设置 **ComfyUI URL**: `http://127.0.0.1:8188`
3. 粘贴测试工作流 JSON
4. 执行工作流
5. 验证工作正常

**3. 检查日志**

```bash
tail -f /path/to/n8n/n8n.log
```

查找：
- 节点成功加载
- 启动时无错误
- ComfyUI 连接工作

## 代码规范

本项目使用：

- **TypeScript** 提供类型安全和更好的开发体验
- **ESLint** 进行代码检查和维护代码质量
- **Prettier** 进行代码格式化

### 提交 PR 前

请确保代码通过所有检查：

```bash
# 运行检查器
npm run lint

# 自动修复检查问题
npm run lintfix

# 运行测试
npm test

# 构建项目
npm run build
```

### n8n 最佳实践

1. **使用 n8n Helpers**
   ```typescript
   // ✅ 好 - 使用 n8n helpers
   const response = await this.helpers.httpRequest({
     method: 'GET',
     url: 'http://comfyui:8188/system_stats',
   });

   // ❌ 差 - 直接使用 axios
   const response = await axios.get('http://comfyui:8188/system_stats');
   ```

2. **适当的错误处理**
   ```typescript
   if (!workflow[nodeId]) {
     throw new NodeOperationError(
       this.getNode(),
       `Node ID "${nodeId}" not found in workflow`
     );
   }
   ```

3. **类型安全**
   ```typescript
   // ✅ 好 - 显式类型
   const nodeParameters: NodeParameterInput =
     this.getNodeParameter('nodeParameters', 0);

   // ❌ 差 - 隐式 any
   const nodeParameters = this.getNodeParameter('nodeParameters', 0);
   ```

## 提交更改

### 1. 创建分支

为新功能或错误修复创建新分支：

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bugfix-name
```

### 2. 进行更改

- 编写清晰简洁的代码
- 遵循现有代码风格
- 为新功能添加测试
- 根据需要更新文档

### 3. 提交更改

使用清晰的提交消息：

```bash
git add .
git commit -m "feat: 添加并发图像获取支持"
```

#### 提交消息约定

我们遵循语义化提交消息：

- `feat:` - 新功能
- `fix:` - 错误修复
- `docs:` - 文档更改
- `style:` - 代码风格更改（格式化等）
- `refactor:` - 代码重构
- `test:` - 添加或更新测试
- `chore:` - 维护任务

### 4. 推送到您的 Fork

```bash
git push origin feature/your-feature-name
```

### 5. 提交 Pull Request

1. 转到 GitHub 上的原始仓库
2. 点击 "Pull Requests"
3. 点击 "New Pull Request"
4. 选择您的分支
5. 填写 PR 模板
6. 提交 PR

## 编码标准

### TypeScript 最佳实践

- **始终定义类型** - 避免使用 `any`。使用适当的 TypeScript 接口和类型。
- **使用 `unknown` 而不是 `any`** - 当您不知道类型时，使用 `unknown` 并验证。
- **启用严格模式** - 项目使用 TypeScript 严格模式。
- **添加 JSDoc 注释** - 使用 JSDoc 记录公共 API。

```typescript
// ✅ 好
interface UserInput {
  name: string;
  email: string;
}

function processUser(input: UserInput): void {
  // ...
}

// ❌ 差
function processUser(input: any): void {
  // ...
}
```

### 错误处理

- 始终适当处理错误
- 对异步操作使用 try-catch 块
- 提供有意义的错误消息

```typescript
// ✅ 好
async function fetchData(): Promise<Data> {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ❌ 差
async function fetchData(): Promise<Data> {
  return await apiCall(); // 无错误处理
}
```

### 命名约定

- **文件**: 使用 kebab-case (`comfy-ui-client.ts`)
- **类**: 使用 PascalCase (`ComfyUIClient`)
- **函数/变量**: 使用 camelCase (`getImageBuffer`)
- **常量**: 使用 UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **接口**: 使用 PascalCase (`WorkflowConfig`)

### 代码组织

- 保持函数小而专注
- 一个文件应包含一个主类或导出
- 将相关功能分组在一起
- 为复杂逻辑添加注释

### 测试

- 为所有新功能编写单元测试
- 目标是高测试覆盖率（目标：70%+）
- 测试成功和错误情况
- 使用描述性测试名称

```typescript
describe('ComfyUIClient', () => {
  describe('executeWorkflow', () => {
    it('should execute workflow successfully', async () => {
      // 测试实现
    });

    it('should handle errors gracefully', async () => {
      // 测试实现
    });
  });
});
```

## 安全考虑

### SSRF 防护

项目实现了两种 URL 验证策略，以平衡安全性和实际使用需求。

#### 1. `validateUrl()` - 用于 ComfyUI 服务器地址

**用途**: 验证用户配置的 ComfyUI 服务器 URL

**特点**: ✅ **允许私有地址**
- 允许 `localhost`、`127.0.0.1`
- 允许私有 IP 段：`10.x.x.x`、`172.16.x.x`、`192.168.x.x`
- 仅验证 HTTP/HTTPS 协议

**使用场景**:
```typescript
// ✅ 允许 - ComfyUI 通常部署在本地
validateUrl('http://localhost:8188')
validateUrl('http://127.0.0.1:8188')
validateUrl('http://192.168.1.100:8188')
validateUrl('https://comfyui.example.com')

// ❌ 拒绝 - 不安全的协议
validateUrl('ftp://example.com')
validateUrl('javascript:alert(1)')
```

#### 2. `validateExternalUrl()` - 用于外部资源 URL

**用途**: 验证从外部获取的 URL（如用户输入的图像 URL）

**特点**: 🛡️ **阻止私有地址（SSRF 防护）**
- 阻止 `localhost`、`127.0.0.1`
- 阻止所有私有 IP 段
- 仅允许公网地址

**使用场景**:
```typescript
// ✅ 允许 - 公网地址
validateExternalUrl('https://example.com/image.png')
validateExternalUrl('http://api.example.com/resource')

// ❌ 拒绝 - 私有地址（SSRF 防护）
validateExternalUrl('http://localhost:8188')
validateExternalUrl('http://127.0.0.1:8188')
validateExternalUrl('http://192.168.1.1/image.png')
validateExternalUrl('http://10.0.0.1/resource')
```

### 为什么需要两种策略？

**使用场景差异**

| 场景 | 来源 | 信任度 | 策略 |
|------|------|--------|------|
| **ComfyUI 服务器** | 用户手动配置 | 高 | 允许私有地址 |
| **外部资源 URL** | 用户输入/外部数据 | 低 | 阻止私有地址 |

**安全考虑**

1. **ComfyUI 服务器 URL**
   - 由用户在 n8n 节点配置中手动输入
   - 用户有完全控制权
   - 通常部署在本地或私有网络
   - ✅ **无需 SSRF 限制**

2. **外部资源 URL**
   - 可能来自工作流输入或外部数据
   - 存在 SSRF 攻击风险
   - 攻击者可能尝试扫描内网
   - 🛡️ **需要 SSRF 防护**

### 其他安全注意事项

- **验证所有输入** - 永远不要信任用户输入
- **清理数据** - 在使用前清理数据
- **处理缓冲区大小** - 验证文件大小以防止 DoS
- **使用 HTTPS** - 始终使用安全连接
- **不要暴露密钥** - 永远不要提交凭据

## 添加新功能

### 1. 添加新参数类型

编辑 `ComfyUi.node.ts`:

```typescript
{
  displayName: 'Type',
  name: 'type',
  type: 'options',
  options: [
    { name: 'Text', value: 'text' },
    { name: 'Number', value: 'number' },
    { name: 'Boolean', value: 'boolean' },
    { name: 'Binary', value: 'binary' },
    // 在此添加新类型
  ],
}
```

更新 `types.ts`:

```typescript
export interface NodeParameterConfig {
  type?: 'text' | 'number' | 'boolean' | 'binary' | 'new-type';
}
```

在 execute() 中处理:

```typescript
case 'new-type':
  // 处理新参数类型
  parsedValue = processNewType(value);
  workflow[nodeId].inputs[paramName] = parsedValue;
  break;
```

### 2. 扩展客户端功能

编辑 `ComfyUiClient.ts`:

```typescript
async newFeature(params: any): Promise<Result> {
  const response = await this.helpers.httpRequest({
    method: 'POST',
    url: `${this.baseUrl}/new-endpoint`,
    json: true,
    body: params,
    timeout: this.timeout,
  });

  return processResponse(response);
}
```

## 调试

### 启用调试日志

```typescript
import { createLogger } from '../logger';

const logger = createLogger('ComfyUi');

// 在您的代码中
logger.debug('Debug message', { data: value });
logger.info('Info message');
logger.error('Error message', error);
```

### 检查节点输出

```bash
# 查看 n8n 日志
tail -f ~/.n8n/logs/n8n.log

# 或您的自定义 n8n 日志位置
tail -f /path/to/n8n/n8n.log
```

## 问题反馈

### 错误报告

报告错误时，请包括：

- 清晰的标题和描述
- 复现步骤
- 预期行为
- 实际行为
- 环境详情（Node.js 版本、操作系统等）
- 适用时的屏幕截图
- 堆栈跟踪或错误消息

### 功能请求

请求功能时，请包括：

- 功能的清晰描述
- 用例或解决的问题
- 可能的实现想法
- 适用时的示例

## 获取帮助

如果您需要帮助：

- 检查现有的问题和讨论
- 阅读文档
- 在 GitHub Discussions 中提问
- 加入我们的社区聊天（如果有）

## 发布到 npm

### 前置条件

1. **npm 账户** - 在 https://www.npmjs.com/signup 创建
2. **启用 2FA** - 发布所需
3. **干净构建** - `npm run build` 和 `npm run lint` 必须通过

### 发布步骤

```bash
# 1. 更新 package.json 中的版本
npm version patch  # 或 minor, major

# 2. 构建
npm run build

# 3. 检查代码质量
npm run lint

# 4. 发布
npm publish --access public
```

### 版本指南

- **Major** (1.0.0 → 2.0.0): 破坏性更改
- **Minor** (1.0.0 → 1.1.0): 新功能，向后兼容
- **Patch** (1.0.0 → 1.0.1): 错误修复

## 许可证

通过贡献，您同意您的贡献将在 MIT 许可证下获得许可。

---

感谢您的贡献！🎉
