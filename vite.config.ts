/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/bela/ on GitHub Pages.
export default defineConfig({
  base: '/bela/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
