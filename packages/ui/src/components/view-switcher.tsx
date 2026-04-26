import { FolderOpen, LayoutGrid } from 'lucide-react'

import { cn } from '@/lib/utils'

const VIEWS = [
  { id: 'profiles', label: 'Profiles', icon: FolderOpen },
  { id: 'agent-home', label: 'Agent Home', icon: LayoutGrid },
] as const

export type ViewId = (typeof VIEWS)[number]['id']

interface ViewSwitcherProperties {
  active: ViewId
  onChange: (id: ViewId) => void
}

export function ViewSwitcher({ active, onChange }: ViewSwitcherProperties) {
  return (
    <div className="flex items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-1 w-full">
      {VIEWS.map(({ id, icon: Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            title={id === 'profiles' ? 'Profiles' : 'Agent Home'}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-2 transition-colors',
              isActive
                ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.03)]',
            )}
          >
            <Icon size={16} />
          </button>
        )
      })}
    </div>
  )
}
