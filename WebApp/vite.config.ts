import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@ksamint/core-editor': fileURLToPath(
        new URL('../CoreEditor/src/standalone.ts', import.meta.url),
      ),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    target: ['safari18', 'chrome126', 'firefox128'],
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) {
            return 'react';
          }
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer')) {
            return 'editor';
          }
          return undefined;
        },
      },
    },
  },
});
