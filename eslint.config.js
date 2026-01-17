const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...(tsPlugin.configs.recommended?.rules || {}),
      ...(reactPlugin.configs.recommended?.rules || {}),
      ...(reactHooksPlugin.configs.recommended?.rules || {}),
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/prisma/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'pnpm-lock.yaml'],
  },
];
