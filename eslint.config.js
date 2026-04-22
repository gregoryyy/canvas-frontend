import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/**',
      // Pre-migration ES module sources. main/canvas/util port to src/*.ts in
      // phase 1 M4–M6. Ignore until then.
      'main.js',
      'canvas.js',
      'util.js',
      // Legacy Jasmine specs (ported to Vitest in M7) and vendored Jasmine.
      'test/**/*.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
