import { motion, useReducedMotion } from 'framer-motion'

import { LanyardStage } from './lanyard-stage'
import { AnimatedNumber, useMonitorStats } from './monitor-stats'

import type { ReactNode } from 'react'

const statsClassName = 'font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]'
const motionEaseOut = [0.23, 1, 0.32, 1] as const

export function MonitorView() {
  const reduceMotion = useReducedMotion() ?? false
  const { stats, isLoading, isError, isEmpty } = useMonitorStats()

  return (
    <section
      aria-labelledby="monitor-title"
      className="relative h-full min-h-[720px] overflow-hidden bg-[var(--bg-marketing)] text-[var(--text-primary)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_36%_42%,rgba(255,255,255,0.08),transparent_32%),radial-gradient(circle_at_76%_54%,rgba(255,255,255,0.05),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative grid h-full min-h-[720px] grid-cols-[minmax(420px,1fr)_minmax(360px,520px)] items-center gap-10 px-20 py-16 pl-[300px] max-xl:grid-cols-1 max-xl:items-end max-xl:pl-[280px] max-lg:px-8 max-lg:pl-[260px] max-md:min-h-[780px] max-md:px-5 max-md:pb-12 max-md:pt-28">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(12px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: reduceMotion ? 0 : 0.24, ease: motionEaseOut }}
        >
          <LanyardStage />
        </motion.div>

        <motion.div
          className="relative z-10 max-w-[520px]"
          initial={reduceMotion ? false : { opacity: 0, transform: 'translateX(18px)' }}
          animate={{ opacity: 1, transform: 'translateX(0px)' }}
          transition={{ duration: reduceMotion ? 0 : 0.26, delay: reduceMotion ? 0 : 0.04, ease: motionEaseOut }}
        >
          <p className={statsClassName}>Personal signal</p>
          <h1 id="monitor-title" className="mt-3 text-[52px] font-[510] leading-none tracking-[-0.8px] text-[var(--text-primary)] max-md:text-[40px]">
            Coding Monitor
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-6 text-[var(--text-tertiary)]">
            {stats.scopeLabel}
          </p>

          <dl className="mt-10 space-y-8" aria-busy={isLoading}>
            <MonitorStat label="sessions" value={<AnimatedNumber value={stats.sessions} />} />
            <MonitorStat label="tokens" value={<AnimatedNumber value={stats.tokens} />} />
            <MonitorStat label="last sync" value={stats.lastSyncLabel} />
          </dl>

          {isLoading
            ? (
            <p role="status" className="mt-8 font-mono text-[11px] uppercase tracking-[0.04em] text-[var(--text-quaternary)]">
              Loading monitor signal
            </p>
              )
            : null}
          {isEmpty
            ? (
            <p className="mt-8 max-w-sm text-[14px] leading-6 text-[var(--text-tertiary)]">
              Run a Claude Code session and your activity will appear here.
            </p>
              )
            : null}
          {isError
            ? (
            <p role="status" className="mt-8 max-w-sm text-[14px] leading-6 text-[var(--text-tertiary)]">
              Timeline signal unavailable. Monitor will update after the next successful sync.
            </p>
              )
            : null}
        </motion.div>
      </div>
    </section>
  )
}

function MonitorStat({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div>
      <dt className={statsClassName}>{label}</dt>
      <dd className="mt-1 text-[64px] font-[510] leading-none tracking-[-0.8px] text-[var(--text-primary)] max-md:text-[46px]">
        {value}
      </dd>
    </div>
  )
}
