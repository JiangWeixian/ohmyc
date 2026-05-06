// Type aliases for Lucide icon components used across entity cards and sections.
import type { LucideIcon } from 'lucide-react'

/** Convenience alias for any Lucide icon component. */
export type IconType = LucideIcon

/** Minimal props interface shared by icon-using components. */
export interface IconProps {
  size?: number
  className?: string
}
