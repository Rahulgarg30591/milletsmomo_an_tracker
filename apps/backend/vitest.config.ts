import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration tests need a real database and have their own config.
    exclude: ['node_modules/**', 'dist/**', 'tests/integration/**'],
  },
});
