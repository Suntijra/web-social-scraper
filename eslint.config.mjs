import eslint from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import prettierPlugin from 'eslint-plugin-prettier/recommended' // Integrate prettier
import importPlugin from 'eslint-plugin-import'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import globals from 'globals'
import unusedImportsPlugin from 'eslint-plugin-unused-imports'

export default defineConfig([
  globalIgnores(['**/node_modules/', '.git/', 'dist/']),
  {
    ignores: ['node_modules/', 'dist/', 'build/'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.bun,
      },
    },
  },
  eslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      import: importPlugin,
      '@typescript-eslint': tseslint.plugin,
      'unused-imports': unusedImportsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      'react/no-unescaped-entities': 'off',
      'react/no-unknown-property': 'off',
      'react/display-name': 'off',

      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'eol-last': ['error', 'always'],
      'linebreak-style': ['error', 'unix'],
      'no-console': 'warn',
      'no-unused-vars': 'off',
      'no-var': 'error',
      'node/no-unsupported-features/es-syntax': 'off',
      'prefer-const': 'error',
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
        }),
      ],
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-duplicate-imports': 'off',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
  },
  prettierPlugin,
])
