/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'tests/**',
      'migrations/**',
      '__mocks__/**',
      '*.config.js',
      '*.config.ts',
      'jest.*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'off',
    },
  }
);