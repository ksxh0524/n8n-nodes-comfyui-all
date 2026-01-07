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
    // Change from 'off' to 'warn' to maintain type safety while allowing gradual improvements
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
    // Additional recommended rules for better code quality
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
  },
  ignorePatterns: ['package.json', 'nodes/__tests__'],
  overrides: [
    {
      files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
