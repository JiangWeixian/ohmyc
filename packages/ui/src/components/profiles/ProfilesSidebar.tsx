import { Plus, FolderOpen, Bot, Sparkles, TerminalSquare, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../cn';
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
        <AnimatePresence mode="popLayout">
          {profiles.map((p, index) => {
            const isActive = active === p.name;
            const isSelected = selection?.type === 'profile' && selection.name === p.name;
            return (
              <motion.button
                key={p.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: index * 0.03, duration: 0.15 }}
                onClick={() => onSelect({ type: 'profile', name: p.name })}
                type="button"
                whileHover={{ x: 1 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'w-full flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-[13px] font-medium transition-smooth',
                  isSelected
                    ? 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/12 text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:border-white/5 hover:bg-white/[0.03] hover:text-[var(--text-primary)]'
                )}
              >
                {isActive && (
                  <span className="shrink-0 text-[10px] font-medium text-[#5E6AD2] bg-[#5E6AD2]/15 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                )}
                <span className="truncate">{p.name}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>

        <motion.button
          onClick={() => onSelect({ type: 'new-profile' })}
          type="button"
          whileHover={{ x: 1 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'mt-2 w-full flex items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--border-default)] px-3 py-2 text-[13px] font-medium text-[var(--text-tertiary)] transition-smooth',
            'hover:border-[var(--border-hover)] hover:bg-white/[0.03] hover:text-[var(--text-primary)]'
          )}
        >
          <motion.span
            whileHover={{ rotate: 90 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Plus size={14} />
          </motion.span>
          New Profile
        </motion.button>

        <div className="mt-5 px-1 py-2 text-[9px] font-medium uppercase text-[var(--text-tertiary)]">
          Components
        </div>
        {[
          { category: 'agents' as const, label: 'Agents', icon: Bot },
          { category: 'skills' as const, label: 'Skills', icon: Sparkles },
          { category: 'commands' as const, label: 'Commands', icon: TerminalSquare },
          { category: 'model-configs' as const, label: 'Model Configs', icon: Settings },
        ].map(({ category, label, icon: Icon }) => (
          <motion.button
            key={category}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onSelect({ type: 'components', category })}
            type="button"
            whileHover={{ x: 1 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'mb-1 w-full flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-[13px] font-medium transition-smooth',
              selection?.type === 'components' && selection.category === category
                ? 'border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/12 text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:border-white/5 hover:bg-white/[0.03] hover:text-[var(--text-primary)]'
            )}
          >
            <motion.span
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Icon size={14} />
            </motion.span>
            {label}
          </motion.button>
        ))}
      </nav>
    </aside>
  );
}
