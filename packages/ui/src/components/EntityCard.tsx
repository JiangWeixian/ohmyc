import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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

// Re-export Badge and MonoBadge from dedicated file for backward compatibility
export { Badge, MonoBadge } from './Badge';
