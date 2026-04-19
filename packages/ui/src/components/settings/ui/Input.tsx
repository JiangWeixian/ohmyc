import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';

type MotionInputProps = Omit<HTMLMotionProps<'input'>, 'children'>;

interface InputProps extends MotionInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <motion.div
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          >
            {icon}
          </motion.div>
        )}
        <motion.input
          whileFocus={{ scale: 1.005 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className={cn(
            'w-full bg-[var(--surface-base)] px-3 py-2 text-[13px] text-[var(--text-primary)]',
            'border border-[var(--border-default)]',
            'hover:border-[var(--border-hover)]',
            'focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20',
            'outline-none transition-colors duration-150',
            'rounded-[var(--radius-md)]',
            'placeholder:text-[var(--text-tertiary)]',
            icon && 'pl-9',
            error && 'border-[var(--accent-red)] focus:border-[var(--accent-red)] focus:ring-[var(--accent-red)]/20',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <motion.span
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[12px] text-[var(--accent-red)]"
        >
          {error}
        </motion.span>
      )}
    </div>
  );
}
