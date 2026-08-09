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

Use this agent when a change needs a focused **implementation review**. It checks behavior, boundaries, and *missing tests*.

## When to use

Trigger this agent when a pull request touches:

1. Data-fetching hooks or query boundaries
2. Component state lifecycle (\`useEffect\` cleanup, race conditions)
3. Accessibility contracts — keyboard, ARIA, focus order

> A good review names the risk, not just the fix. Surface the *why* before the *what*.

### Checklist

- [ ] Behavior matches the original request
- [ ] Error states are handled, not swallowed
- [x] Tests cover the happy path
- [ ] No unhandled promise rejections

## Inline styles

You can use \`inline code\`, **bold**, _italics_, and ~~strikethrough~~ freely. Links like [the docs](https://example.com) render with underlines.

## Code block

\`\`\`ts
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
\`\`\`

## Comparison table

| Hook        | Returns            | Cancellable |
| ----------- | ------------------ | ----------- |
| \`useAgent\`   | \`Agent \| null\`     | No          |
| \`useAgents\`  | \`Agent[]\`          | No          |
| \`useDebounce\`| \`T\`                | Yes         |

---

Nested list:

- Signals
  - Monitor — full-bleed dashboard
  - Timeline — session activity
- Resources
  - Agents, Skills, Commands
`

export const entityDescriptions = {
  short: 'Reviews implementation changes before they land.',
  long: 'Reviews implementation changes across product-critical UI surfaces, checks data flow boundaries, and keeps feedback focused on behavior, visual regressions, and missing tests.',
}
