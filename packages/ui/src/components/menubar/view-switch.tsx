// Icon-only area/heatmap view switch for the menubar popover header.

export type MenubarView = 'area' | 'heatmap'

interface ViewSwitchProps {
  value: MenubarView
  onChange: (next: MenubarView) => void
}

export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  return (
    <div className="flex shrink-0 items-center gap-0.5" role="tablist" aria-label="View">
      <button
        type="button"
        role="tab"
        aria-label="Area chart view"
        aria-pressed={value === 'area'}
        data-active={value === 'area'}
        onClick={() => onChange('area')}
        className="menubar-view-button"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1 11 L4 7 L7 9 L10 4 L13 6 V12 H1 Z"
            fill="currentColor"
            opacity="0.2"
          />
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
        data-active={value === 'heatmap'}
        onClick={() => onChange('heatmap')}
        className="menubar-view-button"
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
