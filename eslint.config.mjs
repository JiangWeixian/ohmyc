import { aiou } from '@aiou/eslint-config'

const config = await aiou({ ssr: false })

export default [
  {
    ignores: ['vendor/**', '.planning/**/*.md', '.claude/**', 'docs/**', '.agents/**'],
  },
  ...config,
  {
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      'unicorn/filename-case': 'off',
    },
  },
  {
    files: [
      'packages/ui/.storybook/**/*.{ts,tsx}',
      'packages/ui/src/**/*.stories.{ts,tsx}',
      'packages/ui/vitest.workspace.ts',
    ],
    rules: {
      'import/no-default-export': 'off',
      'import/no-extraneous-dependencies': 'off',
    },
  },
]
