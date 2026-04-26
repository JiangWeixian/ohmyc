import {
  Bot,
  FolderOpen,
  Plus,
  Settings,
  Sparkles,
  TerminalSquare,
  User,
} from 'lucide-react'

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { Profile } from '@claudeui/shared'

export type SidebarSelection
  = { type: 'components'; category: 'agents' | 'commands' | 'model-configs' | 'skills' } | { type: 'new-profile' } | { type: 'profile'; name: string }

interface ProfilesSidebarProperties {
  profiles: Profile[]
  active: string | null
  selection: SidebarSelection | null
  onSelect: (sel: SidebarSelection) => void
  headerSlot?: React.ReactNode
}

function SidebarHeader({ headerSlot }: { headerSlot?: React.ReactNode }) {
  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] px-4 pb-4 pt-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[var(--text-primary)]">
          <FolderOpen size={18} />
        </div>
        <span className="text-[15px] font-semibold text-[var(--text-primary)]">
          Profiles
        </span>
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

export function ProfilesSidebar({ profiles, active, selection, onSelect, headerSlot }: ProfilesSidebarProperties) {
  const currentValue = getTabValue(selection)

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
        <div className="mb-3 px-1 text-[13px] font-medium text-[var(--text-tertiary)]">
          My Profiles
        </div>
        <Tabs
          value={currentValue}
          onValueChange={handleValueChange}
          orientation="vertical"
        >
          <TabsList className="flex w-full flex-col gap-1 bg-transparent p-0 border-0">
            {profiles.map((p) => {
              const isActive = active === p.name
              const value = `profile:${p.name}`
              const isSelected = currentValue === value
              return (
                <TabsTrigger
                  key={p.name}
                  value={value}
                  className={cn(
                    'relative w-full flex items-center justify-start gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-medium transition-colors duration-150',
                    isSelected
                      ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
                  )}
                >
                  <span className={cn('relative z-10', isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
                    <User size={16} />
                  </span>
                  <span className="relative z-10 truncate">{p.name}</span>
                  {isActive && (
                    <span className="relative z-10 ml-auto shrink-0 text-[10px] font-medium text-[var(--text-primary)] bg-[rgba(255,255,255,0.08)] px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </TabsTrigger>
              )
            })}

            <TabsTrigger
              value="new-profile"
              className={cn(
                'relative w-full flex items-center justify-start gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-medium transition-colors duration-150',
                currentValue === 'new-profile'
                  ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
              )}
            >
              <span className={cn('relative z-10', currentValue === 'new-profile' ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
                <Plus size={16} />
              </span>
              <span className="relative z-10">New Profile</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-5 mb-3 px-1 text-[13px] font-medium text-[var(--text-tertiary)]">
          Components
        </div>
        <Tabs
          value={currentValue}
          onValueChange={handleValueChange}
          orientation="vertical"
        >
          <TabsList className="flex w-full flex-col gap-1 bg-transparent p-0 border-0">
            {COMPONENTS.map(({ category, label, icon: Icon }) => {
              const value = `component:${category}`
              const isSelected = currentValue === value
              return (
                <TabsTrigger
                  key={category}
                  value={value}
                  className={cn(
                    'relative w-full flex items-center justify-start gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-medium transition-colors duration-150',
                    isSelected
                      ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
                  )}
                >
                  <span className={cn('relative z-10', isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
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
