import { expect, it } from 'vitest'

import { totalSessionTokens } from '../src/lib/token-usage'

it('does not double count Codex cache and retains other sources cache', () => {
  const usage = { tokens_input: 100, tokens_output: 20, tokens_cached: 80 }
  expect(totalSessionTokens({ ...usage, agent_name: 'codex' })).toBe(120)
  for (const agent_name of ['claude', 'opencode', 'grok', null]) {
    expect(totalSessionTokens({ ...usage, agent_name })).toBe(200)
  }
  expect(totalSessionTokens({ tokens_input: 100, tokens_output: 20, tokens_cached: 0, agent_name: 'codex' })).toBe(120)
})

it('does not invent usage when the collector has none', () => {
  expect(totalSessionTokens({ agent_name: 'cursor', tokens_input: 0, tokens_output: 0, tokens_cached: 0 })).toBe(0)
})
