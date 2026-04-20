import React from 'react';
import { Blocks } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { IconType } from './icons';

export interface SidebarSection {
  id: string;
  label: string;
  icon: IconType;
}

export function StatusIndicator() {
  return (
    <div className="border-t border-[var(--border-default)] px-3 py-3">
      <div className="panel-subtle flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--text-secondary)]">
        <span className="inline-flex size-2 rounded-full bg-[var(--accent-green)]" />
        <span className="tabular-nums">Ready</span>
        <span className="text-[var(--text-tertiary)]">Local workspace indexed</span>
      </div>
    </div>
  );
}

function SidebarHeader({ headerSlot }: { headerSlot?: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border-default)] px-4 pb-4 pt-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--accent-blue)]">
          <Blocks size={14} />
        </div>
        <div>
          <div className="text-[9px] font-medium uppercase text-[var(--text-tertiary)]">
            Claude UI
          </div>
          <div className="text-[15px] font-medium text-[var(--text-primary)]">Workspace</div>
        </div>
      </div>
      {headerSlot && <div className="w-full">{headerSlot}</div>}
    </div>
  );
}

interface SidebarProps {
  sections: SidebarSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  statusIndicator?: React.ReactNode;
  headerSlot?: React.ReactNode;
}

export function Sidebar({
  sections,
  activeSection,
  onSectionChange,
  statusIndicator,
  headerSlot,
}: SidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r border-[var(--border-default)] bg-[var(--surface-panel)]">
      <SidebarHeader headerSlot={headerSlot} />
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-3 px-1 text-[9px] font-medium uppercase text-[var(--text-tertiary)]">
          Explore
        </div>
        <Tabs
          value={activeSection}
          onValueChange={onSectionChange}
          orientation="vertical"
        >
          <TabsList className="flex w-full flex-col gap-1 bg-transparent p-0 border-0">
            {sections.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <TabsTrigger
                  key={section.id}
                  value={section.id}
                  className={cn(
                    "relative w-full flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-[13px] font-medium",
                    "transition-colors",
                    isActive
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-[var(--radius-sm)] border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/12 shadow-[var(--shadow-xs)]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className={cn("relative z-10", isActive ? "text-[var(--accent-blue)]" : "text-[var(--text-tertiary)]")}>
                    <section.icon size={16} />
                  </span>
                  <span className="relative z-10">{section.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </nav>

      {statusIndicator}
    </aside>
  );
}
