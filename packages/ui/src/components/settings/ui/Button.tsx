import { cn } from '../../cn';
import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-[12px] gap-1.5',
    md: 'px-3.5 py-2 text-[13px] gap-2',
    lg: 'px-4 py-2.5 text-[14px] gap-2',
  };

  const variantClasses = {
    primary: cn(
      'bg-[var(--accent-blue)] text-white',
      'hover:bg-[var(--accent-blue-hover)] hover:shadow-[var(--shadow-sm)]'
    ),
    secondary: cn(
      'bg-[var(--surface-overlay)] text-[var(--text-primary)]',
      'border border-[var(--border-default)]',
      'hover:bg-[var(--border-hover)] hover:border-[var(--border-hover)]'
    ),
    ghost: cn(
      'bg-transparent text-[var(--text-secondary)]',
      'hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]'
    ),
    danger: cn(
      'bg-[var(--accent-red)] text-white',
      'hover:opacity-90 hover:shadow-[var(--shadow-sm)]'
    ),
  };

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={cn(
        'inline-flex items-center justify-center font-medium',
        'rounded-[var(--radius-md)]',
        'transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1000, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 size={14} className="animate-spin" />
        </motion.span>
      ) : (
        <>
          {icon && (
            <motion.span
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              {icon}
            </motion.span>
          )}
          {children}
        </>
      )}
    </motion.button>
  );
}
