import { aiou } from '@aiou/eslint-config'

const config = await aiou({ ssr: false })

export default [
  ...config,
  {
    ignores: ['vendor/**'],
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      'unicorn/filename-case': 'off',
    },
  },
]
