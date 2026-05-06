// Renders a styled list of model-config key changes (ADD, REMOVE, CHANGE)
// with sensitive values truncated for display.

import { truncateUrl } from '../../utils/truncate-url'

interface ModelConfigChangeListProperties {
  title: string
  changes: Array<{ key: string; action: string; value?: string; previousValue?: string }>
}

const SENSITIVE_KEYS = new Set(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'API_TIMEOUT_MS'])

/**
 * Displays model-config environment variable changes in a compact mono list.
 * Sensitive keys are automatically masked via truncateUrl.
 */
export function ModelConfigChangeList({ title, changes }: ModelConfigChangeListProperties) {
  return (
    <div className="bg-[#5E6AD2]/8 border border-[#5E6AD2]/15 rounded-[var(--radius-md)] p-4">
      <p className="text-[#5E6AD2] text-[13px] font-semibold mb-1">{title}</p>
      <ul className="text-[13px] font-mono space-y-0.5">
        {changes.map(c => (
          <li key={c.key}>
            <span className="text-[var(--accent-amber)] font-semibold">{c.action}</span>{' '}
            <span className="text-[var(--text-secondary)]">
              {c.action === 'REMOVE'
                ? c.key
                : `${c.key}=${SENSITIVE_KEYS.has(c.key) && c.value ? truncateUrl(c.value) : c.value ?? ''}`}
            </span>
            {c.action === 'CHANGE' && c.previousValue && (
              <span className="text-[var(--text-tertiary)]">
                {' '}(was: {SENSITIVE_KEYS.has(c.key) ? truncateUrl(c.previousValue) : c.previousValue})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
