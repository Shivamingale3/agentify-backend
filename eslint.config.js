import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import vitestPlugin from '@vitest/eslint-plugin';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['node_modules/', 'dist/', 'prisma.config.ts', 'src/prisma/'],
  },

  // Base JS rules
  js.configs.recommended,

  // Strict type-checked TS rules + stylistic (scoped to TS files)
  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- Variables ---
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // --- Type safety ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],

      // --- Promises ---
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // --- Template Strings ---
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
        },
      ],

      // --- Imports ---
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.{1,2}/',
              message: 'Use the #* alias instead (e.g. #utils/logger.js).',
            },
          ],
        },
      ],

      // --- Style ---
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // --- Console ---
      'no-console': 'error',
    },
  },

  // Test files (permissive — testing may use console, any, etc.)
  // No projectService here so test files don't need to be in any tsconfig
  // project. Trade-off: type-checked linting rules don't apply to test files,
  // which is fine — they're exercised via `tsc --noEmit -p tsconfig.test.json`.
  {
    files: ['tests/**/*.test.ts'],
    extends: [...tseslint.configs.recommended, vitestPlugin.configs.recommended],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // Prettier must come after all ESLint configs to disable conflicting rules
  prettier,
);
