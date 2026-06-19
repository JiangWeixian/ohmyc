import type { Origin, RenderBadge } from '@ohmyc/shared'

export const entityOrigins = ['claude', 'opencode'] satisfies Origin[]

export const entityBadges = [
  { kind: 'mono', label: 'opus' },
  { kind: 'pill', label: 'bash', tone: 'neutral' },
] satisfies RenderBadge[]

export const entityMeta = [
  { label: 'scope', value: 'project' },
  { label: 'source', value: 'opencode' },
  { label: 'mode', value: 'primary' },
  { label: 'permission.edit', value: 'deny' },
  { label: 'permission.bash', value: 'ask' },
]

export const entityMarkdown = `# Review agent

Use this agent when a change needs a focused implementation review.

- Check behavior against the request
- Inspect error handling and state boundaries
- Call out missing tests
`

export const entityDescriptions = {
  short: 'Reviews implementation changes before they land.',
  long: 'Reviews implementation changes across product-critical UI surfaces, checks data flow boundaries, and keeps feedback focused on behavior, visual regressions, and missing tests.',
}
