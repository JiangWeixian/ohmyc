import { ContributionGraph } from '@ohmyc/ui/components/timeline/contribution-graph'

import type { HeatmapPoint } from '@ohmyc/ui/hooks/use-timeline'

const CURRENT_YEAR = new Date().getFullYear()

// Stub dataset — flat zero values for the current calendar year.
// Replaced with real DB-backed data in the sidecar slice.
const stubData: HeatmapPoint[] = Array.from({ length: 53 * 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (53 * 7 - i))
  return { date: d.toISOString().slice(0, 10), value: 0 }
})

export function Menubar() {
  return (
    <div style={{ padding: 18, background: '#191a1b', color: '#e6e7e8', minHeight: '100vh' }}>
      <div style={{ fontSize: 13, fontWeight: 510, marginBottom: 14 }}>
        OhMyC Menubar — Scaffold
      </div>
      <ContributionGraph year={CURRENT_YEAR} metric="sessions" data={stubData} />
    </div>
  )
}
