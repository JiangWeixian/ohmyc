import { Blocks, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const VIEWS = [
  { id: 'profiles', label: 'Profiles', icon: FolderOpen },
  { id: 'agent-home', label: 'Agent Home', icon: Blocks },
] as const;

export type ViewId = (typeof VIEWS)[number]['id'];

interface ViewSwitcherProps {
  active: ViewId;
  onChange: (id: ViewId) => void;
}

export function ViewSwitcher({ active, onChange }: ViewSwitcherProps) {
  return (
    <Tabs value={active} onValueChange={(v) => onChange(v as ViewId)}>
      <TabsList className="grid w-full grid-cols-2 gap-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)] p-1">
        {VIEWS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <TabsTrigger
              key={id}
              value={id}
              className={cn(
                "relative flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] font-medium",
                "transition-colors",
                isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="view-switcher-active"
                  className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface-overlay)] shadow-[var(--shadow-xs)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className={cn("relative z-10", isActive ? "text-[var(--accent-blue)]" : "text-[var(--text-tertiary)]")}>
                <Icon size={14} />
              </span>
              <span className="relative z-10 truncate">{label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
