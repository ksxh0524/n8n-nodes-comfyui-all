/**
 * ESLint Configuration for n8n-nodes-comfyui-all
 * Uses ESLint v9 flat config format
 */

const n8nNodesBase = require('eslint-plugin-n8n-nodes-base');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'docs/**',
      'nodes/__tests__/**',
      '**/*.test.ts',
      '**/__tests__/**/*.ts',
    ],
  },
  {
    files: ['nodes/**/*.ts', 'nodes/**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        extraFileExtensions: ['.json'],
      },
    },
    settings: {
      'n8n-nodes-base': {
        nodesPath: './nodes',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'n8n-nodes-base': n8nNodesBase,
    },
    rules: {
      ...n8nNodesBase.configs.nodes.rules,
      ...typescriptEslint.configs.recommended.rules,

      // Type safety rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // n8n-nodes-base specific
      'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
    },
  },
];
