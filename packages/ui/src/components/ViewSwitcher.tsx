import { Blocks, FolderOpen } from 'lucide-react';
import { cn } from './cn';

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
    <div className="grid w-full grid-cols-2 gap-1 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-panel)] p-1">
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;

        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            type="button"
            className={cn(
              'flex w-full min-w-0 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] font-medium transition-smooth',
              isActive
                ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] shadow-[var(--shadow-xs)]'
                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
            )}
          >
            <span className={isActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'}>
              <Icon size={14} />
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
