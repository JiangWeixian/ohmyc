import { cn } from '../../cn';
import { motion } from 'framer-motion';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-start gap-3">
      <motion.button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        whileTap={{ scale: 0.95 }}
        className={cn(
          'relative w-9 h-5 flex-shrink-0 mt-0.5',
          'rounded-full',
          'transition-colors duration-150',
          'focus:ring-2 focus:ring-[var(--accent-blue)]/20 focus:ring-offset-1 focus:ring-offset-[var(--surface-base)]',
          checked
            ? 'bg-[var(--accent-blue)]'
            : 'bg-[var(--surface-overlay)] border border-[var(--border-default)]'
        )}
      >
        <motion.span
          initial={false}
          animate={{
            x: checked ? 16 : 0,
            backgroundColor: checked ? '#ffffff' : 'var(--text-tertiary)'
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={cn(
            'absolute top-[2px] left-[2px] w-[16px] h-[16px] bg-white rounded-full',
            'shadow-sm'
          )}
        />
      </motion.button>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <motion.label
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              className="text-[13px] font-medium text-[var(--text-primary)] cursor-pointer"
              onClick={() => onChange(!checked)}
            >
              {label}
            </motion.label>
          )}
          {description && (
            <span className="text-[12px] text-[var(--text-tertiary)]">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
