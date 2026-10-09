/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cspPlugin } from './config/csp';

// Served from https://<user>.github.io/bela/ on GitHub Pages.
export default defineConfig(({ mode }) => ({
  base: '/bela/',
  plugins: [react(), tailwindcss(), cspPlugin(loadEnv(mode, process.cwd(), 'VITE_').VITE_CONVEX_URL)],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    // convex-test must be bundled by vite to see import.meta.glob and the edge runtime.
    server: { deps: { inline: ['convex-test'] } },
  },
}));
