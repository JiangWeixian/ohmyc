import React from 'react';
import { Blocks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { IconType } from './icons';

export interface SidebarSection {
  id: string;
  label: string;
  icon: IconType;
}

function SidebarHeader({ title, headerSlot }: { title?: string; headerSlot?: React.ReactNode }) {
  return (
    <div className="border-b border-[rgba(255,255,255,0.05)] px-4 pb-4 pt-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[var(--text-primary)]">
          <Blocks size={18} />
        </div>
        {title && (
          <span className="text-[15px] font-semibold text-[var(--text-primary)]">
            {title}
          </span>
        )}
      </div>
      {headerSlot && <div className="w-full overflow-hidden">{headerSlot}</div>}
    </div>
  );
}

interface SidebarProps {
  sections: SidebarSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  title?: string;
  headerSlot?: React.ReactNode;
}

export function Sidebar({
  sections,
  activeSection,
  onSectionChange,
  title,
  headerSlot,
}: SidebarProps) {
  return (
    <aside className="flex w-60 flex-col border-r border-[rgba(255,255,255,0.05)] bg-[var(--bg-panel)]">
      <SidebarHeader title={title} headerSlot={headerSlot} />
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-3 px-1 text-[13px] font-medium text-[var(--text-tertiary)]">
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
                    "relative w-full flex items-center justify-start gap-3 rounded-md px-3 py-2.5 text-left text-[13px] font-medium",
                    "transition-colors duration-150",
                    isActive
                      ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]"
                  )}
                >
                  <span className={cn("relative z-10", isActive ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]")}>
                    <section.icon size={16} />
                  </span>
                  <span className="relative z-10">{section.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </nav>
    </aside>
  );
}