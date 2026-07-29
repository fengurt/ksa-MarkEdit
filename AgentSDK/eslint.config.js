import eslint from '@eslint/js';
import globals from 'globals';
import typescript from 'typescript-eslint';

export default typescript.config(
  {
    ignores: ['dist'],
  },
  {
    files: ['src/**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...typescript.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
);
