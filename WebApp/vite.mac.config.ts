import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      '@ksamint/core-editor': fileURLToPath(
        new URL('../CoreEditor/src/standalone.ts', import.meta.url),
      ),
    },
  },
  build: {
    target: 'safari18',
    outDir: 'dist-mac',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./mac-index.html', import.meta.url)),
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
