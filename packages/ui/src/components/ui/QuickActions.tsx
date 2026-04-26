import React from 'react';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

/**
 * A floating quick actions component with CSS transitions.
 * Perfect for contextual actions that appear on hover or selection.
 */
export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1',
        'bg-[var(--surface-overlay)] border border-[var(--border-default)]',
        'rounded-[var(--radius-lg)] shadow-[var(--shadow-md)]',
        'transition-colors duration-150',
        className
      )}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-[12px] font-medium',
            'transition-colors duration-150',
            action.variant === 'primary'
              ? 'bg-[var(--text-primary)] text-[var(--bg-marketing)] hover:bg-[var(--text-secondary)]'
              : action.variant === 'danger'
                ? 'text-[var(--accent-red)] hover:bg-red-500/10'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]'
          )}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A floating action button (FAB) with CSS transitions.
 */
export function FloatingActionButton({
  icon,
  onClick,
  label,
  className,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2',
        'size-10 rounded-full',
        'bg-[var(--text-primary)] text-[var(--bg-marketing)]',
        'shadow-[var(--shadow-lg)]',
        'hover:scale-105 hover:shadow-lg active:scale-95',
        'transition-transform duration-150',
        className
      )}
    >
      {icon}
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
}
