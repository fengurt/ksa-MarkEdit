import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: './src/@preview',
  resolve: {
    alias: {
      '@codemirror/lang-markdown': fileURLToPath(new URL('../@vendor/lang-markdown', import.meta.url)),
    },
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./rendered-preview.html', import.meta.url)),
    },
  },
  plugins: [viteSingleFile()],
});
