const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  // coverage/ and the Playwright output are generated; linting them reports
  // problems in files nobody edits.
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/test-results/**', '**/playwright-report/**'] },
  {
    extends: [...tseslint.configs.recommended],
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
