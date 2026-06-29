// Shared shell for every /explore/* route. Renders the motion.main backdrop,
// the NavigationIsland mount point, and (by default) the padded
// explorer-content-shell wrapper. Pass padded={false} for full-bleed pages
// (currently only Monitor).
import { motion, useTransform } from 'framer-motion'

import { NavigationIsland } from './navigation-island'
import { useIslandStore } from '@/state/island-store'

import type { PropsWithChildren } from 'react'

interface ExplorerLayoutProperties {
  /** When true (default), wraps children in the padded explorer-content-shell. */
  padded?: boolean
}

export function ExplorerLayout({ children, padded = true }: PropsWithChildren<ExplorerLayoutProperties>) {
  const hoverProgress = useIslandStore(s => s.hoverProgress)
  const pageFilter = useTransform(hoverProgress, v => `blur(${v * 8}px) brightness(${1 - v * 0.5})`)
  const pageScale = useTransform(hoverProgress, [0, 1], [1, 0.96])
  const dimBg = useTransform(hoverProgress, v => `rgba(0,0,0,${v * 0.3})`)

  return (
    <div className="relative h-full min-w-0 overflow-hidden font-sans text-[var(--text-primary)]">
      <NavigationIsland />

      <motion.div
        style={{ background: dimBg }}
        className="pointer-events-none fixed inset-0 z-30"
      />

      <motion.main
        style={{ filter: pageFilter, scale: pageScale }}
        className="relative h-full min-w-0 origin-center overflow-hidden bg-[var(--bg-marketing)]"
      >
        {padded
          ? (
              <div className="h-full overflow-y-auto">
                <div
                  data-testid="explorer-content-shell"
                  className="min-h-full w-full px-10 pb-12 pl-[280px] pt-10 max-lg:pl-[260px] max-md:px-5 max-md:pb-8 max-md:pt-24"
                >
                  <div className="w-full max-w-6xl">{children}</div>
                </div>
              </div>
            )
          : children}
      </motion.main>
    </div>
  )
}
