import { aiou } from '@aiou/eslint-config'

const config = await aiou({ ssr: false })

export default [
  {
    ignores: ['vendor/**', '.planning/**/*.md', '.claude/**', 'docs/**'],
  },
  ...config,
  {
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      'unicorn/filename-case': 'off',
    },
  },
]
