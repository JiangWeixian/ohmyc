// Animated button with spring hover/tap, loading pulse, and optional glow effect.
// Wraps the shadcn Button with framer-motion micro-interactions.

'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ButtonProps } from '@/components/ui/button'
import type { ReactNode } from 'react'

/** Props for the animated NativeButton component. */
export interface NativeButtonProps extends ButtonProps {
  children: ReactNode
  loading?: boolean
  glow?: boolean
}

const NativeButton = ({
  className,
  variant = 'default',
  size = 'lg',
  children,
  loading = false,
  glow = false,
  disabled,
  ...properties
}: NativeButtonProps) => {
  const shouldReduceMotion = useReducedMotion()

  const buttonContent = (
    <>
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      <motion.span
        className={cn('flex items-center gap-2')}
/** Pulsing opacity while loading signals activity without jarring layout shifts. */
        animate={
          loading
            ? { opacity: shouldReduceMotion ? 1 : [1, 0.5, 1] }
            : { opacity: 1 }
        }
        transition={
          loading && !shouldReduceMotion
            ? { duration: 1, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }
        }
      >
        {children}
      </motion.span>
    </>
  )

  // Glassmorphism base: layered shadows and conditional glow produce
  // depth without heavy backgrounds, keeping the button feel translucent.
  const glassmorphismClassName = cn(
    'cursor-pointer h-12 rounded-md px-7 text-sm relative overflow-hidden',
    !glow && 'shadow-md hover:shadow-lg',
    glow
    && 'shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-[box-shadow,background-color,color,opacity] duration-200',
    variant === 'outline' && 'text-foreground/80 hover:bg-foreground/5',
    (disabled || loading) && 'opacity-50 cursor-not-allowed grayscale',
    className,
  )

  return (
    <motion.div
      whileHover={
        !disabled && !loading && !shouldReduceMotion ? { scale: 1.02 } : {}
      }
      whileTap={
        !disabled && !loading && !shouldReduceMotion ? { scale: 0.98 } : {}
      }
      // Spring physics give a tactile "press" feel — stiff spring + low damping
      // keeps the motion quick and snappy rather than floaty.
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className="relative block w-fit"
    >
      // Radial glow layer: a blurred primary-tinted div behind the button
      // that fades in on hover, creating a soft halo effect.
      {glow && !disabled && !loading && (
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl opacity-0 hover:opacity-100 transition-opacity duration-500" />
      )}
      <Button
        variant={variant}
        size={size}
        className={glassmorphismClassName}
        disabled={disabled || loading}
        aria-busy={loading}
        {...properties}
      >
        {buttonContent}
      </Button>
    </motion.div>
  )
}

NativeButton.displayName = 'NativeButton'

export { NativeButton }
