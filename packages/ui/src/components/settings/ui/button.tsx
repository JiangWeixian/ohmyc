// Settings-scoped button that adapts variant/size names to the underlying NativeButton API.

import React from 'react'

import { NativeButton } from '@/components/uitripled/native-button'

interface ButtonProperties {
  variant?: 'danger' | 'ghost' | 'primary' | 'secondary'
  size?: 'lg' | 'md' | 'sm'
  loading?: boolean
  icon?: React.ReactNode
  children?: React.ReactNode
  disabled?: boolean
  className?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'reset' | 'submit'
}

// Maps settings-style variant names to NativeButton's built-in variants.
const variantMap: Record<string, 'default' | 'destructive' | 'ghost' | 'outline'> = {
  primary: 'default',
  secondary: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
}

const sizeMap: Record<string, 'default' | 'lg' | 'sm'> = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
}

/**
 * Reusable button for settings forms. Wraps NativeButton with settings-specific
 * variant and size tokens so consumers don't need to know the underlying API.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...properties
}: ButtonProperties) {
  return (
    <NativeButton
      variant={variantMap[variant] || 'default'}
      size={sizeMap[size] || 'default'}
      loading={loading}
      disabled={disabled}
      className={className}
      {...properties}
    >
      {icon}
      {children}
    </NativeButton>
  )
}
