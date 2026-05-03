import {
  Activity,
  Bot,
  LayoutGrid,
  Plus,
  Settings,
  Sparkles,
  TerminalSquare,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { Profile } from '@claudeui/shared'

export type SidebarSelection
  = { type: 'components'; category: 'agents' | 'commands' | 'model-configs' | 'skills'; editName?: string } | { type: 'new-profile' } | { type: 'profile'; name: string }

interface ProfilesSidebarProperties {
  profiles: Profile[]
  active: string | null
  selection: SidebarSelection | null
  onSelect: (sel: SidebarSelection) => void
  onCompare?: (profileName: string) => void
  onActivate?: (profileName: string) => void
  headerSlot?: React.ReactNode
  timelineActive?: boolean
}

function SidebarHeader({ headerSlot }: { headerSlot?: React.ReactNode }) {
  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] px-4 pb-4 pt-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
          <LayoutGrid size={18} className="text-[var(--text-secondary)]" />
        </div>
        <span className="text-[15px] font-[590] text-[var(--text-primary)]">Profiles</span>
      </div>
      {headerSlot && <div className="w-full overflow-hidden">{headerSlot}</div>}
    </div>
  )
}

// Compound value format for Tabs
function getTabValue(selection: SidebarSelection | null): string {
  if (!selection) {
    return ''
  }
  if (selection.type === 'profile') {
    return `profile:${selection.name}`
  }
  if (selection.type === 'new-profile') {
    return 'new-profile'
  }
  if (selection.type === 'components') {
    return `component:${selection.category}`
  }
  return ''
}

function parseTabValue(value: string): SidebarSelection | null {
  if (value.startsWith('profile:')) {
    return { type: 'profile', name: value.slice(8) }
  }
  if (value === 'new-profile') {
    return { type: 'new-profile' }
  }
  if (value.startsWith('component:')) {
    return { type: 'components', category: value.slice(10) as any }
  }
  return null
}

const COMPONENTS = [
  { category: 'agents' as const, label: 'Agents', icon: Bot },
  { category: 'skills' as const, label: 'Skills', icon: Sparkles },
  { category: 'commands' as const, label: 'Commands', icon: TerminalSquare },
  { category: 'model-configs' as const, label: 'Model Configs', icon: Settings },
] as const

export function ProfilesSidebar({ profiles, active, selection, onSelect, onCompare, onActivate, headerSlot, timelineActive }: ProfilesSidebarProperties) {
  const currentValue = getTabValue(selection)
  const navigate = useNavigate()

  const handleValueChange = (value: string) => {
    const parsed = parseTabValue(value)
    if (parsed) {
      onSelect(parsed)
    }
  }

  return (
    <aside className="flex w-60 flex-col border-r border-[rgba(255,255,255,0.05)] bg-[var(--bg-panel)]">
      <SidebarHeader headerSlot={headerSlot} />
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-2 px-2 pt-1 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
          Activity
        </div>
        <button
          type="button"
          onClick={() => navigate('/timeline')}
          className={cn(
            'mb-2 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] transition-colors duration-150',
            timelineActive
              ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
          )}
        >
          <span className={cn('shrink-0', timelineActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
            <Activity size={16} />
          </span>
          <span>Timeline</span>
        </button>

        <div className="mb-2 mt-5 px-2 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
          My Profiles
        </div>
        <Tabs
          value={currentValue}
          onValueChange={handleValueChange}
          orientation="vertical"
        >
          <TabsList className="flex w-full flex-col bg-transparent p-0 border-0">
            {profiles.map((p) => {
              const isActive = active === p.name
              const value = `profile:${p.name}`
              const isSelected = currentValue === value
              return (
                <TabsTrigger
                  key={p.name}
                  value={value}
                  className={cn(
                    'group relative mb-0.5 w-full flex items-center justify-start gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] transition-colors duration-150',
                    isSelected
                      ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
                  )}
                >
                  <span className={cn('relative z-10 shrink-0', isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
                    <User size={16} />
                  </span>
                  <span className="relative z-10 truncate">{p.name}</span>
                  <span className="relative z-10 ml-auto flex items-center gap-1">
                    {isActive && (
                      <span className="shrink-0 rounded bg-[var(--text-primary)] px-1.5 py-0.5 text-[10px] font-[590] text-[var(--bg-marketing)] tracking-[0.04em] uppercase">
                        Active
                      </span>
                    )}
                    {/* Hover actions */}
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
                      {!isActive && onActivate && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            onActivate(p.name)
                          }}
                          role="button"
                          tabIndex={0}
                          className="rounded border border-transparent bg-[var(--text-primary)] px-1.5 py-0.5 text-[10px] font-[510] text-[var(--bg-marketing)] hover:bg-[var(--text-secondary)] cursor-pointer"
                        >
                          Activate
                        </span>
                      )}
                      {onCompare && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            onCompare(p.name)
                          }}
                          role="button"
                          tabIndex={0}
                          className="rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[10px] font-[510] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          Compare
                        </span>
                      )}
                    </span>
                  </span>
                </TabsTrigger>
              )
            })}

            <TabsTrigger
              value="new-profile"
              className={cn(
                'relative mb-0.5 w-full flex items-center justify-start gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] transition-colors duration-150',
                currentValue === 'new-profile'
                  ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
              )}
            >
              <span className={cn('relative z-10 shrink-0', currentValue === 'new-profile' ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
                <Plus size={16} />
              </span>
              <span className="relative z-10">New Profile</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mb-2 mt-5 px-2 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
          Components
        </div>
        <Tabs
          value={currentValue}
          onValueChange={handleValueChange}
          orientation="vertical"
        >
          <TabsList className="flex w-full flex-col bg-transparent p-0 border-0">
            {COMPONENTS.map(({ category, label, icon: Icon }) => {
              const value = `component:${category}`
              const isSelected = currentValue === value
              return (
                <TabsTrigger
                  key={category}
                  value={value}
                  className={cn(
                    'relative mb-0.5 w-full flex items-center justify-start gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] transition-colors duration-150',
                    isSelected
                      ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
                  )}
                >
                  <span className={cn('relative z-10 shrink-0', isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
                    <Icon size={16} />
                  </span>
                  <span className="relative z-10">{label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </nav>
    </aside>
  )
}
