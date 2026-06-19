// Button wrapper with loading state and restrained press feedback.

'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ButtonProps } from '@/components/ui/button'
import type { ReactNode } from 'react'

/** Props for the NativeButton component. */
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
  glow: _glow = false,
  disabled,
  ...properties
}: NativeButtonProps) => {
  const buttonClassName = cn(
    'relative h-12 cursor-pointer overflow-hidden rounded-md px-7 text-sm',
    'transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out',
    'active:scale-[0.97]',
    variant === 'outline' && 'text-foreground/80 hover:bg-foreground/5',
    (disabled || loading) && 'cursor-not-allowed opacity-50 grayscale active:scale-100',
    className,
  )

  return (
    <Button
      variant={variant}
      size={size}
      className={buttonClassName}
      disabled={disabled || loading}
      aria-busy={loading}
      {...properties}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      <span className="flex items-center gap-2">
        {children}
      </span>
    </Button>
  )
}

NativeButton.displayName = 'NativeButton'

export { NativeButton }
