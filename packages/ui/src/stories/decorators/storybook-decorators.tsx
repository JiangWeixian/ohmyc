import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

import type { TimelineMetric } from '@/hooks/use-timeline'
import type { Decorator } from '@storybook/react-vite'
import type { ReactNode } from 'react'

export function createStoryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  })
}

export const withQueryClient: Decorator = Story => (
  <QueryClientProvider client={createStoryQueryClient()}>
    <Story />
  </QueryClientProvider>
)

export const withRouter = (initialEntries: string[] = ['/explore/timeline']): Decorator => Story => (
  <MemoryRouter initialEntries={initialEntries}>
    <Story />
  </MemoryRouter>
)

export function withMockTransport(installHandlers: () => void): Decorator {
  return (Story) => {
    resetMock()
    __setTransportForTests('mock')
    installHandlers()
    return <Story />
  }
}

export function installTimelineHandlers({
  years,
  projects,
  heatmapByMetric,
  events,
  status,
}: {
  years: number[]
  projects: string[]
  heatmapByMetric: Partial<Record<TimelineMetric, Array<{ date: string; value: number }>>>
  events: unknown
  status: { sessionCount: number; lastSyncAt: number | null }
}) {
  setMockHandler('timeline.years', async () => ({ years }))
  setMockHandler('timeline.projects', async () => ({ projects }))
  setMockHandler('timeline.heatmap', async (args) => {
    const metric = (args as { metric?: TimelineMetric }).metric ?? 'sessions'
    return { data: heatmapByMetric[metric] ?? [] }
  })
  setMockHandler('timeline.events', async () => events)
  setMockHandler('timeline.status', async () => status)
}

export function MenubarFrame({ children }: { children: ReactNode }) {
  return (
    <div className="p-8">
      <div className="flex min-h-[360px] w-[390px] justify-center overflow-visible p-3">
        {children}
      </div>
    </div>
  )
}
