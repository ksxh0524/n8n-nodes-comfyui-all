# Contributing to n8n-nodes-comfyui-all

Thank you for your interest in contributing! We appreciate your help in improving this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to maintain a welcoming and inclusive community.

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- Git

### 1. Fork the Repository

Click the "Fork" button in the top right corner of the repository page.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/n8n-nodes-comfyui-all.git
cd n8n-nodes-comfyui-all
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development

```bash
npm run dev
```

This will start TypeScript in watch mode and automatically recompile on changes.

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

Coverage reports will be generated in the `coverage/` directory.

### Run Linter

```bash
npm run lint
```

### Fix Linter Issues

```bash
npm run lintfix
```

## Code Style

This project uses:

- **TypeScript** for type safety and better developer experience
- **ESLint** for code linting and maintaining code quality
- **Prettier** for code formatting

### Before Submitting a PR

Please ensure your code passes all checks:

```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lintfix

# Run tests
npm test

# Build the project
npm run build
```

## Submitting Changes

### 1. Create a Branch

Create a new branch for your feature or bugfix:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bugfix-name
```

### 2. Make Your Changes

- Write clear, concise code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed

### 3. Commit Your Changes

Use clear commit messages:

```bash
git add .
git commit -m "feat: add support for concurrent image fetching"
```

#### Commit Message Convention

We follow semantic commit messages:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### 4. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 5. Submit a Pull Request

1. Go to the original repository on GitHub
2. Click "Pull Requests"
3. Click "New Pull Request"
4. Select your branch
5. Fill out the PR template
6. Submit the PR

## Coding Standards

### TypeScript Best Practices

- **Always define types** - Avoid using `any`. Use proper TypeScript interfaces and types.
- **Use `unknown` instead of `any`** - When you don't know the type, use `unknown` and validate.
- **Enable strict mode** - The project uses TypeScript strict mode.
- **Add JSDoc comments** - Document public APIs with JSDoc.

```typescript
// ✅ Good
interface UserInput {
  name: string;
  email: string;
}

function processUser(input: UserInput): void {
  // ...
}

// ❌ Bad
function processUser(input: any): void {
  // ...
}
```

### Error Handling

- Always handle errors appropriately
- Use try-catch blocks for async operations
- Provide meaningful error messages

```typescript
// ✅ Good
async function fetchData(): Promise<Data> {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ❌ Bad
async function fetchData(): Promise<Data> {
  return await apiCall(); // No error handling
}
```

### Naming Conventions

- **Files**: Use kebab-case (`comfy-ui-client.ts`)
- **Classes**: Use PascalCase (`ComfyUIClient`)
- **Functions/Variables**: Use camelCase (`getImageBuffer`)
- **Constants**: Use UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: Use PascalCase (`WorkflowConfig`)

### Code Organization

- Keep functions small and focused
- One file should contain one main class or export
- Group related functionality together
- Add comments for complex logic

### Testing

- Write unit tests for all new functionality
- Aim for high test coverage (target: 70%+)
- Test both success and error cases
- Use descriptive test names

```typescript
describe('ComfyUIClient', () => {
  describe('executeWorkflow', () => {
    it('should execute workflow successfully', async () => {
      // Test implementation
    });

    it('should handle errors gracefully', async () => {
      // Test implementation
    });
  });
});
```

### Security Considerations

- **Validate all inputs** - Never trust user input
- **Sanitize data** - Clean data before using it
- **Handle buffer sizes** - Validate file sizes to prevent DoS
- **Use HTTPS** - Always use secure connections
- **Don't expose secrets** - Never commit credentials

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- Clear title and description
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS, etc.)
- Screenshots if applicable
- Stack traces or error messages

### Feature Requests

When requesting features, please include:

- Clear description of the feature
- Use case or problem it solves
- Possible implementation ideas
- Examples if applicable

## Getting Help

If you need help:

- Check existing issues and discussions
- Read the documentation
- Ask questions in GitHub Discussions
- Join our community chat (if available)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for your contributions! 🎉
