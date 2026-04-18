import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../cn';

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
 * A floating quick actions component with smooth animations.
 * Perfect for contextual actions that appear on hover or selection.
 */
export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex items-center gap-1 p-1',
        'bg-[var(--surface-overlay)] border border-[var(--border-default)]',
        'rounded-[var(--radius-lg)] shadow-[var(--shadow-md)]',
        className
      )}
    >
      {actions.map((action, index) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.03, duration: 0.1 }}
          onClick={action.onClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-[12px] font-medium',
            'transition-colors duration-150',
            action.variant === 'primary'
              ? 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]'
              : action.variant === 'danger'
                ? 'text-[var(--accent-red)] hover:bg-red-500/10'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]'
          )}
        >
          {action.icon}
          {action.label}
        </motion.button>
      ))}
    </motion.div>
  );
}

/**
 * A floating action button (FAB) with smooth animations.
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
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'flex items-center justify-center gap-2',
        'size-10 rounded-full',
        'bg-[var(--accent-blue)] text-white',
        'shadow-[var(--shadow-lg)]',
        'hover:shadow-[var(--shadow-lg)]',
        'transition-shadow duration-150',
        className
      )}
    >
      {icon}
      {label && <span className="sr-only">{label}</span>}
    </motion.button>
  );
}

/**
 * A tooltip that appears on hover with smooth animations.
 */
export function Tooltip({
  children,
  content,
  side = 'top',
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [isVisible, setIsVisible] = React.useState(false);

  const sideStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
              'absolute z-50 px-2 py-1 text-[11px] font-medium',
              'bg-[var(--surface-overlay)] text-[var(--text-primary)]',
              'border border-[var(--border-default)]',
              'rounded-[var(--radius-md)] shadow-[var(--shadow-md)]',
              'whitespace-nowrap',
              sideStyles[side]
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
