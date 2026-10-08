/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Served from https://<user>.github.io/bela/ on GitHub Pages.
export default defineConfig({
  base: '/bela/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // convex-test must be bundled by vite to see import.meta.glob and the edge runtime.
    server: { deps: { inline: ['convex-test'] } },
  },
});
