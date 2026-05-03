import { Activity, LayoutGrid } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { IconType } from './icons'

export interface SidebarSection {
  id: string
  label: string
  icon: IconType
}

function SidebarHeader({ headerSlot }: { headerSlot?: React.ReactNode }) {
  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] px-4 pb-4 pt-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
          <LayoutGrid size={18} className="text-[var(--text-secondary)]" />
        </div>
        <span className="text-[15px] font-[590] text-[var(--text-primary)]">Explorer</span>
      </div>
      {headerSlot && <div className="w-full overflow-hidden">{headerSlot}</div>}
    </div>
  )
}

interface SidebarProperties {
  sections: SidebarSection[]
  activeSection: string
  onSectionChange: (id: string) => void
  title?: string
  headerSlot?: React.ReactNode
}

export function Sidebar({
  sections,
  activeSection,
  onSectionChange,
  headerSlot,
}: SidebarProperties) {
  const navigate = useNavigate()
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
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-primary)]"
        >
          <span className="shrink-0 text-[var(--text-tertiary)]">
            <Activity size={16} />
          </span>
          <span>Timeline</span>
        </button>

        <div className="mb-2 mt-5 px-2 text-[11px] font-[510] tracking-[0.04em] uppercase text-[var(--text-tertiary)]">
          Explore
        </div>
        <Tabs
          value={activeSection}
          onValueChange={onSectionChange}
          orientation="vertical"
        >
          <TabsList className="flex w-full flex-col bg-transparent p-0 border-0">
            {sections.map((section) => {
              const isActive = activeSection === section.id
              return (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className={cn(
                    'relative mb-0.5 w-full flex items-center justify-start gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-[510]',
                    'transition-colors duration-150',
                    isActive
                      ? 'bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]',
                  )}
                >
                  <span className={cn('relative z-10 shrink-0', isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]')}>
                    <section.icon size={16} />
                  </span>
                  <span className="relative z-10">{section.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </nav>
    </aside>
  )
}
