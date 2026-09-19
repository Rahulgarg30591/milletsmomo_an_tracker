/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Rendering a MUI page in jsdom is slow, and slower again when several
    // files run at once. The default 5s was tripping on load, not hanging.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
