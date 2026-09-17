// Minimal ESLint 9 flat config for this Vue 3 + TS project.
//
// Uses the recommended rule sets from the already-installed
// `@typescript-eslint` packages and `eslint-plugin-vue` rather than
// hand-rolling a custom rule list. `.vue` files are parsed with
// `vue-eslint-parser` (a transitive dep of `eslint-plugin-vue`), which in
// turn delegates `<script>` block parsing to `@typescript-eslint/parser` so
// TS syntax inside `.vue` files is understood.

import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default [
  js.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];
