import type { Origin } from '@ohmyc/shared'

const VALID_ORIGINS: readonly Origin[] = ['claude', 'opencode', 'agents']

export function parseOriginsQuery(value: string | undefined): Origin[] | undefined {
  if (!value) {
    return undefined
  }
  const parts = value.split(',').map(s => s.trim()).filter(Boolean)
  const filtered = parts.filter((p): p is Origin => (VALID_ORIGINS as readonly string[]).includes(p))
  return filtered.length > 0 ? filtered : undefined
}
