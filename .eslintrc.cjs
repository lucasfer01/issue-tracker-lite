/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { es2020: true },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: {
    react: { version: 'detect' },
  },
  overrides: [
    {
      files: ['apps/web/src/**/*.{ts,tsx}'],
      env: { browser: true },
      rules: {
        'react/react-in-jsx-scope': 'off',
      },
    },
    {
      files: ['apps/api/src/**/*.ts', 'apps/api/prisma/**/*.ts'],
      env: { node: true },
    },
  ],
  ignorePatterns: ['**/dist/**', '**/node_modules/**'],
};
