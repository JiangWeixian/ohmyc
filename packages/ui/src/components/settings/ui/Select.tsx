import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

export function Select({ label, options, error, className, ...props }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(props.value || '');

  const selectedOption = options.find(o => o.value === selectedValue);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <motion.button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            'w-full bg-[var(--surface-base)] px-3 py-2 text-[13px] text-left flex items-center justify-between',
            'border border-[var(--border-default)]',
            'hover:border-[var(--border-hover)]',
            'focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/20',
            'outline-none transition-colors duration-150',
            'rounded-[var(--radius-md)]',
            error && 'border-[var(--accent-red)] focus:border-[var(--accent-red)] focus:ring-[var(--accent-red)]/20',
            className
          )}
        >
          <span className={selectedOption ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}>
            {selectedOption?.label || 'Select...'}
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
          </motion.span>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={cn(
                'absolute z-50 top-full mt-1 w-full',
                'bg-[var(--surface-overlay)] border border-[var(--border-default)]',
                'rounded-[var(--radius-md)] shadow-[var(--shadow-lg)]',
                'overflow-hidden'
              )}
            >
              {options.map((option, index) => (
                <motion.button
                  key={option.value}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.15 }}
                  onClick={() => {
                    setSelectedValue(option.value);
                    setIsOpen(false);
                    props.onChange?.({ target: { value: option.value } } as any);
                  }}
                  whileHover={{ backgroundColor: 'var(--surface-raised)' }}
                  className={cn(
                    'w-full px-3 py-2 text-[13px] text-left flex items-center justify-between',
                    'transition-colors duration-100',
                    selectedValue === option.value
                      ? 'text-[var(--accent-blue)]'
                      : 'text-[var(--text-primary)]'
                  )}
                >
                  <span>{option.label}</span>
                  {selectedValue === option.value && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 17 }}
                    >
                      <Check size={14} className="text-[var(--accent-blue)]" />
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
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
