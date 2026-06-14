// Icon-only line/heatmap view switch for the menubar popover header.
// 14×14 glyphs, no background, no segmented pill — matches wireframe top-right.

import { useState } from 'react'

export type MenubarView = 'heatmap' | 'line'

interface ViewSwitchProps {
  value: MenubarView
  onChange: (next: MenubarView) => void
}

export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  const [hovered, setHovered] = useState<MenubarView | null>(null)

  const buttonClass
    = 'inline-flex items-center justify-center p-1 rounded-sm bg-transparent border-0 cursor-pointer leading-none transition-none'

  const colorFor = (btn: MenubarView): string => {
    if (value === btn) {
      return 'var(--text-primary)'
    }
    if (hovered === btn) {
      return 'var(--text-secondary)'
    }
    return 'var(--text-quaternary)'
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0" role="tablist" aria-label="View">
      <button
        type="button"
        role="tab"
        aria-label="Line view"
        aria-pressed={value === 'line'}
        onClick={() => onChange('line')}
        onMouseEnter={() => setHovered('line')}
        onMouseLeave={() => setHovered(null)}
        className={buttonClass}
        style={{ color: colorFor('line') }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1 11 L4 7 L7 9 L10 4 L13 6"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        role="tab"
        aria-label="Heatmap view"
        aria-pressed={value === 'heatmap'}
        onClick={() => onChange('heatmap')}
        onMouseEnter={() => setHovered('heatmap')}
        onMouseLeave={() => setHovered(null)}
        className={buttonClass}
        style={{ color: colorFor('heatmap') }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1.5" y="1.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="5.5" y="1.5" width="3" height="3" rx="0.5" fill="currentColor" />
          <rect x="9.5" y="1.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.3" />
          <rect x="1.5" y="5.5" width="3" height="3" rx="0.5" fill="currentColor" />
          <rect x="5.5" y="5.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.3" />
          <rect x="9.5" y="5.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="1.5" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.3" />
          <rect x="5.5" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" opacity="0.5" />
          <rect x="9.5" y="9.5" width="3" height="3" rx="0.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
