import { Plus, FolderOpen, Bot, Sparkles, TerminalSquare, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Profile } from '@claudeui/shared';

export type SidebarSelection =
  | { type: 'profile'; name: string }
  | { type: 'new-profile' }
  | { type: 'components'; category: 'agents' | 'skills' | 'commands' | 'model-configs' };

interface ProfilesSidebarProps {
  profiles: Profile[];
  active: string | null;
  selection: SidebarSelection | null;
  onSelect: (sel: SidebarSelection) => void;
  headerSlot?: React.ReactNode;
}

export function ProfilesSidebar({ profiles, active, selection, onSelect, headerSlot }: ProfilesSidebarProps) {
  const selectedProfile = selection?.type === 'profile' ? selection.name : '';

  return (
    <aside className="flex w-64 flex-col border-r border-[var(--border-default)] bg-[var(--surface-panel)]">
      <div className="border-b border-[var(--border-default)] px-4 pb-4 pt-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--accent-blue)]">
            <FolderOpen size={14} />
          </div>
          <div>
            <div className="text-[9px] font-medium uppercase text-[var(--text-tertiary)]">Claude UI</div>
            <div className="text-[15px] font-medium text-[var(--text-primary)]">Profiles</div>
          </div>
        </div>
        {headerSlot && <div className="w-full">{headerSlot}</div>}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <div className="px-1 py-2 text-[9px] font-medium uppercase text-[var(--text-tertiary)]">
          My Profiles
        </div>
        <Tabs
          value={selectedProfile}
          onValueChange={(v) => onSelect({ type: 'profile', name: v })}
        >
          <TabsList className="flex flex-col gap-1 bg-transparent p-0 border-0">
            {profiles.map((p) => {
              const isActive = active === p.name;
              const isSelected = selection?.type === 'profile' && selection.name === p.name;
              return (
                <TabsTrigger
                  key={p.name}
                  value={p.name}
                  className={cn(
                    'relative w-full flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-[13px] font-medium transition-colors',
                    isSelected
                      ? 'text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]'
                  )}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="profiles-sidebar-active"
                      className="absolute inset-0 rounded-[var(--radius-sm)] border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/12"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {isActive && (
                    <span className="relative z-10 shrink-0 text-[10px] font-medium text-[#5E6AD2] bg-[#5E6AD2]/15 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                  <span className="relative z-10 truncate">{p.name}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <button
          onClick={() => onSelect({ type: 'new-profile' })}
          type="button"
          className={cn(
            'mt-2 w-full flex items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-default)] px-3 py-2 text-[13px] font-medium text-[var(--text-tertiary)] transition-colors',
            'hover:border-[var(--border-hover)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]'
          )}
        >
          <Plus size={14} />
          New Profile
        </button>

        <div className="mt-5 px-1 py-2 text-[9px] font-medium uppercase text-[var(--text-tertiary)]">
          Components
        </div>
        {[
          { category: 'agents' as const, label: 'Agents', icon: Bot },
          { category: 'skills' as const, label: 'Skills', icon: Sparkles },
          { category: 'commands' as const, label: 'Commands', icon: TerminalSquare },
          { category: 'model-configs' as const, label: 'Model Configs', icon: Settings },
        ].map(({ category, label, icon: Icon }) => {
          const isComponentSelected = selection?.type === 'components' && selection.category === category;
          return (
            <button
              key={category}
              onClick={() => onSelect({ type: 'components', category })}
              type="button"
              className={cn(
                'mb-1 w-full flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-[13px] font-medium transition-colors',
                isComponentSelected
                  ? 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/12 text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:border-white/5 hover:bg-white/[0.03] hover:text-[var(--text-primary)]'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
