import { expect, it } from 'vitest'

import { collectClaudeUsage } from '../../src/claude-usage.js'

const row = (id: string, usage: Record<string, unknown>) => ({ type: 'assistant', message: { id, role: 'assistant', usage } })
it('replaces repeated message snapshots and accumulates cache across requests', () => {
  const first = row('a', { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 20 })
  const final = row('a', { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 20 })
  const next = row('b', { input_tokens: 2, output_tokens: 3, cache_creation_input_tokens: 30 })
  expect(collectClaudeUsage([first, final, next, next])).toEqual({ tokensInput: 12, tokensOutput: 8, tokensCached: 50 })
})
it('sums all iterations instead of double counting their top-level totals', () => {
  expect(collectClaudeUsage([row('a', {
    input_tokens: 999,
    iterations: [
      { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 20 },
      { input_tokens: 30, output_tokens: 4, cache_creation_input_tokens: 40 },
    ],
  })])).toEqual({ tokensInput: 40, tokensOutput: 6, tokensCached: 60 })
})
