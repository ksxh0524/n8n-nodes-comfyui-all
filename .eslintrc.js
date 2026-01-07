module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['plugin:n8n-nodes-base/nodes', 'plugin:@typescript-eslint/recommended'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    extraFileExtensions: ['.json'],
  },
  settings: {
    'n8n-nodes-base': {
      nodesPath: './nodes',
    },
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['package.json', 'nodes/__tests__'],
};
