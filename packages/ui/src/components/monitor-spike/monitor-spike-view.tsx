import { Code2 } from 'lucide-react'

import { ComputerBackdrop } from './computer-backdrop'

interface SpikeStat {
  label: string
  value: number
  suffix: string
  precision?: number
}

const stats: SpikeStat[] = [
  { label: 'sessions', value: 842, suffix: '' },
  { label: 'tokens', value: 18.4, suffix: 'M', precision: 1 },
  { label: 'last sync', value: 3, suffix: 'm' },
]

export function MonitorSpikeView() {
  return (
    <section className="relative h-dvh min-h-[720px] overflow-hidden bg-[var(--bg-marketing)] font-['Geist','Inter_var','Inter',sans-serif] text-[var(--text-primary)] max-md:h-auto max-md:min-h-dvh max-md:overflow-y-auto">
      <ComputerBackdrop />
      <SignalField />
      <SpikeIsland />

      <main className="sr-only">
        <h1>Personal Coding Monitor</h1>
        <dl>
          {stats.map(item => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>
                {item.value.toFixed(item.precision ?? 0)}
                {item.suffix}
              </dd>
            </div>
          ))}
        </dl>
      </main>
    </section>
  )
}

function SpikeIsland() {
  return (
    <nav
      aria-label="Monitor spike navigation"
      className="fixed left-[18px] top-[18px] z-30 overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(15,16,17,0.72)] p-2 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-2xl max-md:left-[14px] max-md:top-[14px]"
    >
      <div className="flex items-center justify-center">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
          <Code2 size={17} aria-hidden="true" />
        </div>
      </div>
    </nav>
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
