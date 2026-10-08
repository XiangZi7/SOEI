import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import globals from 'globals'

export default ts.config(
  { ignores: ['dist/**', 'src-tauri/**', 'node_modules/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  // Vue 语义检查与 Prettier 排版分别负责，避免两套模板格式规则冲突。
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: { parser: ts.parser },
      globals: globals.browser,
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.{ts,mjs}', 'scripts/**'],
    languageOptions: { globals: globals.node },
  }
)
