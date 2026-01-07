# Development Guide

Guide for contributors and developers who want to build and modify this node.

## 🛠️ Development Setup

### Prerequisites

- Node.js 18.10+
- npm or yarn
- TypeScript 5.x
- Git

### Clone and Install

```bash
# Clone repository
git clone https://github.com/wwrs/n8n-nodes-comfyui.git
cd n8n-nodes-comfyui

# Install dependencies
npm install

# Build project
npm run build
```

## 📁 Project Structure

```
n8n-nodes-comfyui-all/
├── nodes/
│   ├── ComfyUi/
│   │   ├── ComfyUi.node.ts     # Main node implementation
│   │   └── comfyui.svg          # Node icon
│   ├── ComfyUiClient.ts         # API client for ComfyUI
│   ├── constants.ts             # Configuration constants
│   ├── logger.ts                # Logging utilities
│   ├── types.ts                 # TypeScript type definitions
│   └── validation.ts            # Input validation
├── dist/                        # Compiled JavaScript output
├── index.ts                     # Package entry point
├── package.json                 # Package configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # User documentation
```

## 🔨 Build Commands

### Compile TypeScript

```bash
npm run build
```

### Watch Mode (Development)

```bash
npm run dev
```

Automatically recompiles on file changes.

### Lint Code

```bash
# Check code style
npm run lint

# Fix issues automatically
npm run lintfix
```

### Run Tests

```bash
npm test
```

## 📦 Package Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Watch mode for development |
| `npm run lint` | Check code style with ESLint |
| `npm run lintfix` | Auto-fix linting issues |
| `npm test` | Run test suite |
| `npm run format` | Format code with Prettier |

## 🧪 Testing Locally

### Method 1: Symbolic Link (Recommended for Development)

```bash
# In your n8n custom directory
cd ~/.n8n/custom
npm link /path/to/n8n-nodes-comfyui

# Restart n8n
```

### Method 2: Local Package

```bash
# Build package
cd /path/to/n8n-nodes-comfyui
npm run build
npm pack

# Install in n8n
cd ~/.n8n/custom
npm install /path/to/n8n-nodes-comfyui/n8n-nodes-comfyui-all-*.tgz

# Restart n8n
```

## 🔐 Code Style

This project follows n8n community node standards:

- **TypeScript strict mode** enabled
- **ESLint** with n8n rules
- **Prettier** for code formatting
- **n8n helpers** instead of third-party HTTP libraries

### Key Principles

1. **Use n8n Helpers**
   ```typescript
   // ✅ Good - Use n8n helpers
   const response = await this.helpers.httpRequest({
     method: 'GET',
     url: 'http://comfyui:8188/system_stats',
   });

   // ❌ Bad - Use axios directly
   const response = await axios.get('http://comfyui:8188/system_stats');
   ```

2. **Proper Error Handling**
   ```typescript
   if (!workflow[nodeId]) {
     throw new NodeOperationError(
       this.getNode(),
       `Node ID "${nodeId}" not found in workflow`
     );
   }
   ```

3. **Type Safety**
   ```typescript
   // ✅ Good - Explicit types
   const nodeParameters: NodeParameterInput = 
     this.getNodeParameter('nodeParameters', 0);

   // ❌ Bad - Implicit any
   const nodeParameters = this.getNodeParameter('nodeParameters', 0);
   ```

## 📝 Adding New Features

### 1. Add New Parameter Type

Edit `ComfyUi.node.ts`:

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
    // Add new type here
  ],
}
```

Update `types.ts`:

```typescript
export interface NodeParameterConfig {
  type?: 'text' | 'number' | 'boolean' | 'binary' | 'new-type';
}
```

Handle in execute():

```typescript
case 'new-type':
  // Handle new parameter type
  parsedValue = processNewType(value);
  workflow[nodeId].inputs[paramName] = parsedValue;
  break;
```

### 2. Extend Client Functionality

Edit `ComfyUiClient.ts`:

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

## 🐛 Debugging

### Enable Debug Logging

```typescript
import { createLogger } from '../logger';

const logger = createLogger('ComfyUi');

// In your code
logger.debug('Debug message', { data: value });
logger.info('Info message');
logger.error('Error message', error);
```

### Check Node Output

```bash
# View n8n logs
tail -f ~/.n8n/logs/n8n.log

# Or your custom n8n log location
tail -f /path/to/n8n/n8n.log
```

## 📋 Publishing to npm

### Prerequisites

1. **npm account** - Create at https://www.npmjs.com/signup
2. **2FA enabled** - Required for publishing
3. **Clean build** - `npm run build` and `npm run lint` must pass

### Publish Steps

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Build
npm run build

# 3. Check code quality
npm run lint

# 4. Publish
npm publish --access public
```

### Version Guidelines

- **Major** (1.0.0 → 2.0.0): Breaking changes
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes

## 🤝 Contributing Guidelines

### Before Contributing

1. Check existing [GitHub Issues](https://github.com/wwrs/n8n-nodes-comfyui/issues)
2. Fork the repository
3. Create a feature branch: `git checkout -b feature/amazing-feature`
4. Make your changes
5. Test thoroughly
6. Submit a Pull Request

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Tests pass (`npm test`)
- [ ] Documentation updated
- [ ] Commit messages are clear and descriptive

### Commit Message Format

```
feat: add support for video generation

- Add video output processing
- Update documentation
- Fix edge case in video buffer handling

Closes #123
```

## 🔒 Security Considerations

### SSRF Protection

The node includes SSRF protection to prevent access to private networks:

```typescript
// In validation.ts
export function validateUrl(url: string): boolean {
  // Validates URL and checks against private IP ranges
}
```

### Input Validation

Always validate user input:

```typescript
const workflowValidation = validateComfyUIWorkflow(workflowJson);
if (!workflowValidation.valid) {
  throw new NodeOperationError(
    this.getNode(),
    `Invalid workflow: ${workflowValidation.error}`
  );
}
```

## 📚 Resources

- **[n8n Community Nodes Guide](https://docs.n8n.io/community-nodes/)** - Official n8n documentation
- **[n8n Node Creation](https://docs.n8n.io/nodes/creating-nodes/)** - How to create nodes
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)** - TypeScript documentation
- **[ComfyUI GitHub](https://github.com/comfyanonymous/ComfyUI)** - ComfyUI source code

## 💡 Tips for Contributors

1. **Start with README** - Understand the project first
2. **Test locally** - Use symbolic link for faster iteration
3. **Follow conventions** - Match existing code style
4. **Document changes** - Update relevant docs
5. **Be patient** - Code review takes time

## 📧 Contact

For development questions:
- Open a [GitHub Discussion](https://github.com/wwrs/n8n-nodes-comfyui/discussions)
- Report bugs in [GitHub Issues](https://github.com/wwrs/n8n-nodes-comfyui/issues)

Happy coding! 🚀
