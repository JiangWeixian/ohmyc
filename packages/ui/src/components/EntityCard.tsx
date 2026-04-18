import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';
import type { IconType } from './icons';

interface EntityCardProps {
  icon: IconType;
  iconAccentVar: string;
  title: string;
  description: string;
  badges?: React.ReactNode;
  onClick: () => void;
}

export function EntityCard({
  icon: Icon,
  iconAccentVar,
  title,
  description,
  badges,
  onClick,
}: EntityCardProps) {
  return (
    <motion.button
      onClick={onClick}
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'panel group relative flex w-full flex-col p-5 text-left transition-smooth',
        'hover:border-[var(--border-hover)] hover:bg-[var(--surface-overlay)] hover:shadow-[var(--shadow-sm)]'
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-panel)]',
            `group-hover:bg-[var(${iconAccentVar})]/15`
          )}
        >
          <Icon
            size={18}
            className={cn(
              'text-[var(--text-secondary)]',
              `group-hover:text-[var(${iconAccentVar})]`
            )}
          />
        </div>
        {badges && <div className="flex flex-wrap justify-end gap-1.5">{badges}</div>}
      </div>
      <h3 className="text-[15px] font-medium text-[var(--text-primary)]">{title}</h3>
      <p className="text-pretty mt-2 min-h-[40px] text-[13px] leading-5 text-[var(--text-secondary)] line-clamp-2">
        {description}
      </p>
      <div className="mt-5 flex items-center text-[12px] font-medium text-[var(--accent-blue)]">
        View Details
        <ChevronRight size={12} className="ml-1" />
      </div>
    </motion.button>
  );
}

// Badge components for common use cases
export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'blue' | 'purple' | 'green' | 'amber';
}) {
  const colorClasses = {
    default: 'text-[var(--text-tertiary)] bg-[var(--surface-overlay)]',
    blue: 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10',
    purple: 'text-[var(--accent-purple)] bg-[var(--accent-purple)]/10',
    green: 'text-[var(--accent-green)] bg-[var(--accent-green)]/10',
    amber: 'text-[var(--accent-amber)] bg-[var(--accent-amber)]/10',
  };

  return (
    <span
      className={cn(
        'rounded-[var(--radius-sm)] px-2 py-0.5 text-[10px] font-semibold uppercase',
        colorClasses[variant]
      )}
    >
      {children}
    </span>
  );
}

export function MonoBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[var(--radius-sm)] bg-[var(--surface-panel)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
      {children}
    </span>
  );
}
