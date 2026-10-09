// Lint config. Its main job is the dependency rule from architecture §4:
//   core ← games/* ← ui, pages; convex/ may import core, games and ratings;
//   core, games/*/(non-ui) and ratings never import React, Convex or app UI.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const FRAMEWORKS = [
  { group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'react-router-dom'], message: 'Pure modules must not depend on React (architecture §4).' },
  { group: ['convex', 'convex/*', '@convex-dev/*', '**/convex/**'], message: 'Pure modules must not depend on Convex (architecture §4).' },
];
const APP_LAYERS = { group: ['**/ui/*', '**/ui', '**/pages/*', '**/online/*', '**/account/*', '**/admin/*', '**/i18n/*'], message: 'Pure modules must not import app UI layers (architecture §4).' };

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'convex/_generated', '.convex'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [...FRAMEWORKS, APP_LAYERS, { group: ['**/games/*', '**/games/**', '**/ratings/*'], message: 'core is the bottom layer: it imports nothing from the app (architecture §4).' }] }],
    },
  },
  {
    files: ['src/games/*/**/*.ts', 'src/ratings/**/*.ts'],
    ignores: ['src/games/*/ui/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [...FRAMEWORKS, APP_LAYERS] }] },
  },
  {
    files: ['convex/lib/tableLogic.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [FRAMEWORKS[0], { group: ['convex', 'convex/*'], message: 'tableLogic stays pure so it is unit-tested without Convex.' }] }] },
  },
);
