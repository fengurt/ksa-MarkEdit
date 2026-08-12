import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const preserveEditorConfigPlaceholder = {
  name: 'preserve-editor-config-placeholder',
  enforce: 'post' as const,
  generateBundle(_: unknown, bundle: Record<string, { type: string; source?: string | Uint8Array }>) {
    for (const output of Object.values(bundle)) {
      if (output.type === 'asset' && typeof output.source === 'string') {
        output.source = output.source.replaceAll('`{{EDITOR_CONFIG}}`', '"{{EDITOR_CONFIG}}"');
      }
    }
  },
};

export default defineConfig({
  root: './src/@light',
  resolve: {
    alias: {
      '@codemirror/lang-markdown': fileURLToPath(new URL('../@vendor/lang-markdown', import.meta.url)),
    },
  },
  build: {
    outDir: './dist',
  },
  plugins: [viteSingleFile(), preserveEditorConfigPlaceholder],
});
