/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest config — separate from vite.config.ts to keep the build config
 * focused on production bundling. Tests run in jsdom with React + Testing
 * Library; setup file wires the jest-dom matchers (toBeInTheDocument, etc.)
 *
 * Run:
 *   npm test          one-shot run
 *   npm run test:watch   re-run on change
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
