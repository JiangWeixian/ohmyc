/** Raw Codex input includes cache. Other collectors store disjoint buckets.
 * Never normalize stored input without versioning this read contract as well.
 */
export const TOKEN_TOTAL_SQL = "tokens_input + tokens_output + CASE WHEN agent_name = 'codex' THEN 0 ELSE tokens_cached END"

export function totalSessionTokens(session: {
  agent_name: string | null
  tokens_input: number
  tokens_output: number
  tokens_cached: number
}): number {
  return session.tokens_input + session.tokens_output
    + (session.agent_name === 'codex' ? 0 : session.tokens_cached)
}
