import { useMemo } from 'react'

import { ComputerBackdrop } from './computer-backdrop'
import { formatCompactNumber, useMonitorStats } from '@/components/monitor/monitor-stats'

export function MonitorSpikeView() {
  const { stats, isError, isLoading, isEmpty } = useMonitorStats()
  const sceneStats = useMemo(
    () => ({
      sessions: formatCompactNumber(stats.sessions),
      tokens: formatCompactNumber(stats.tokens),
      turns: formatCompactNumber(stats.turns),
    }),
    [stats.sessions, stats.tokens, stats.turns],
  )
  const accessibleStats = [
    { label: 'sessions', value: sceneStats.sessions },
    { label: 'tokens', value: sceneStats.tokens },
    { label: 'turns', value: sceneStats.turns },
  ]

  return (
    <section className="relative h-dvh min-h-[720px] overflow-hidden bg-[var(--bg-marketing)] font-[var(--font-display)] text-[var(--text-primary)] max-md:h-auto max-md:min-h-dvh max-md:overflow-y-auto">
      <ComputerBackdrop stats={sceneStats} />
      <SignalField />

      {/* A wall of zeros reads as broken. Say why it is empty — but keep it to
          one quiet line so the identity surface stays a monitor, not a banner. */}
      {isEmpty
        ? (
            <p
              className="pointer-events-none absolute inset-x-0 bottom-10 z-[3] text-center text-xs text-[var(--text-tertiary)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              No sessions recorded yet — run one with your agent and it shows up here.
            </p>
          )
        : null}

      <main className="sr-only">
        <h1>Personal Coding Monitor</h1>
        <dl aria-busy={isLoading}>
          {accessibleStats.map(item => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        {isError ? <p>OhMyC could not read timeline activity.</p> : null}
      </main>
    </section>
  )
}

function SignalField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute left-[18%] top-[18%] h-px w-[58vw] -rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]" />
      <div className="absolute left-[12%] top-[64%] h-px w-[52vw] rotate-[9deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)]" />
    </div>
  )
}
