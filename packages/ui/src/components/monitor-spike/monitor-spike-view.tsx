import { motion, useReducedMotion } from 'framer-motion'
import { Atom } from 'lucide-react'

import { ComputerBackdrop } from './computer-backdrop'
// import { Lanyard } from './lanyard'

// Keep these inactive while the computer-background spike is evaluated. They
// were the previous right-side HTML stats and may come back after the monitor
// composition direction is settled.
// interface SpikeStat {
//   label: string
//   value: number
//   suffix: string
//   precision?: number
// }
//
// const stats: SpikeStat[] = [
//   { label: 'sessions', value: 842, suffix: '' },
//   { label: 'tokens', value: 18.4, suffix: 'M', precision: 1 },
//   { label: 'last sync', value: 3, suffix: 'm' },
// ]

export function MonitorSpikeView() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="relative h-dvh min-h-[720px] overflow-hidden bg-[var(--bg-marketing)] font-['Geist','Inter_var','Inter',sans-serif] text-[var(--text-primary)] max-md:h-auto max-md:min-h-dvh max-md:overflow-y-auto">
      <ComputerBackdrop />
      <BackdropBlend />
      <SignalField />
      <SpikeIsland />

      <main className="pointer-events-none relative z-10 grid h-full grid-cols-1 items-center px-16 py-10 pl-[244px] max-xl:pl-[216px] max-lg:pl-[108px] max-md:min-h-dvh max-md:px-5 max-md:pb-10 max-md:pl-5 max-md:pt-24">
        <motion.div
          className="relative min-h-[680px] max-lg:min-h-[520px] max-md:min-h-[570px]"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/*
          <div className="absolute inset-x-[-12%] top-[-92px] h-[820px] max-lg:left-[-16%] max-lg:right-auto max-lg:w-[620px] max-md:left-1/2 max-md:top-[-74px] max-md:h-[580px] max-md:w-[420px] max-md:-translate-x-1/2">
            <Lanyard position={[0, 0, 24]} gravity={[0, -40, 0]} fov={20} transparent lanyardWidth={1} />
          </div>
          */}
        </motion.div>

        {/*
        <motion.div
          className="relative z-20 ml-auto w-full max-w-[460px] max-lg:ml-0 max-lg:max-w-[680px] max-md:max-w-none"
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, delay: 0.12 }}
        >
          <dl className="grid grid-cols-1 gap-9 max-lg:grid-cols-3 max-lg:gap-5 max-md:grid-cols-1 max-md:gap-7">
            {stats.map((item, index) => (
              <motion.div
                key={item.label}
                className="border-t border-[rgba(255,255,255,0.08)] pt-5 max-md:pt-4"
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: 0.18 + index * 0.06 }}
              >
                <dt className="font-['Geist_Mono','Berkeley_Mono',ui-monospace,monospace] text-[13px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] max-md:text-[11px]">
                  {item.label}
                </dt>
                <dd className="mt-3 font-['Geist_Mono','Berkeley_Mono',ui-monospace,monospace] text-[112px] font-[510] leading-none tracking-[-0.08em] text-[var(--text-primary)] [font-variant-numeric:tabular-nums] max-xl:text-[96px] max-lg:text-[72px] max-md:text-[76px]">
                  <AnimatedStat value={item.value} precision={item.precision ?? 0} suffix={item.suffix} />
                </dd>
              </motion.div>
            ))}
          </dl>
        </motion.div>
        */}
      </main>
    </section>
  )
}

// function AnimatedStat({
//   value,
//   precision,
//   suffix,
// }: {
//   value: number
//   precision: number
//   suffix: string
// }) {
//   return (
//     <>
//       {value.toFixed(precision)}
//       {suffix}
//     </>
//   )
// }

function BackdropBlend() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_38%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(90deg,rgba(8,9,10,0.08)_0%,rgba(8,9,10,0.24)_42%,rgba(8,9,10,0.88)_72%,#08090a_100%)]" />
      <div className="absolute inset-y-0 right-0 w-[40%] bg-[linear-gradient(90deg,rgba(8,9,10,0),#08090a_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(0deg,#08090a,rgba(8,9,10,0))]" />
    </div>
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
          <Atom size={17} aria-hidden="true" />
        </div>
      </div>
    </nav>
  )
}

function SignalField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      <div className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute left-[18%] top-[18%] h-px w-[58vw] rotate-[-12deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]" />
      <div className="absolute left-[12%] top-[64%] h-px w-[52vw] rotate-[9deg] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)]" />
    </div>
  )
}
