import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      semi: ['error', 'never'],
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }]
    },
    ignores: ['dist', 'node_modules']
  }
]
