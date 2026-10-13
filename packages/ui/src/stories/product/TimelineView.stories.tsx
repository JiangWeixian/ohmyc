import {
  expect,
  userEvent,
  waitFor,
  within,
} from 'storybook/test'

import { TimelineView } from '@/components/timeline/timeline-view'
import { setMockHandler } from '@/lib/transport/mock'
import {
  installTimelineHandlers,
  withMockTransport,
  withQueryClient,
} from '@/stories/decorators/storybook-decorators'
import {
  longProjectName,
  longProjectTimelineEventsResponse,
  timelineEventsResponse,
  timelineHeatmap,
} from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const populatedHandlers = () => installTimelineHandlers({
  years: [2026],
  projects: ['ohmyc', 'ohmyc-desktop'],
  heatmapByMetric: {
    sessions: timelineHeatmap,
    tokens: timelineHeatmap,
    turns: timelineHeatmap,
  },
  events: timelineEventsResponse,
  status: { sessionCount: 3, lastSyncAt: Date.UTC(2026, 5, 19, 12, 0, 0) },
})

const longProjectHandlers = () => installTimelineHandlers({
  years: [2026],
  projects: [longProjectName, 'ohmyc', 'ohmyc-desktop'],
  heatmapByMetric: {
    sessions: timelineHeatmap,
    tokens: timelineHeatmap,
    turns: timelineHeatmap,
  },
  events: longProjectTimelineEventsResponse,
  status: { sessionCount: 4, lastSyncAt: Date.UTC(2026, 5, 19, 12, 0, 0) },
})

const meta = {
  title: 'Product/Timeline/TimelineView',
  component: TimelineView,
  tags: ['test', 'autodocs'],
  decorators: [
    withQueryClient,
    Story => (
      <div className="h-[760px] w-[1120px] overflow-y-auto">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TimelineView>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {
  decorators: [withMockTransport(populatedHandlers)],
}

export const LongProjectTitle: Story = {
  decorators: [withMockTransport(longProjectHandlers)],
}

export const FullRangeTotals: Story = {
  decorators: [withMockTransport(() => {
    populatedHandlers()
    const year = new Date().getFullYear()
    setMockHandler('timeline.years', async () => ({ years: [year - 1, year] }))
    setMockHandler('timeline.events', async () => ({ ...timelineEventsResponse, nextCursor: 'earlier' }))
    setMockHandler('timeline.heatmap', async (args) => {
      const { metric, from, project } = args as { metric: 'sessions' | 'tokens' | 'turns'; from: number; project?: string }
      const selectedYear = new Date(from).getUTCFullYear()
      const values = project === 'ohmyc-desktop'
        ? (selectedYear === year ? { sessions: 12, turns: 30, tokens: 1_500_000_000 } : { sessions: 0, turns: 0, tokens: 100 })
        : { sessions: 72, turns: 240, tokens: 15_600_000_000 }
      const earlier = Math.floor(values[metric] / 2)
      return { data: [{ date: `${selectedYear}-01-01`, value: earlier }, { date: `${selectedYear}-06-19`, value: values[metric] - earlier }] }
    })
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const stats = () => canvasElement.querySelector('.timeline-stats')!
    await waitFor(() => expect(stats()).toHaveTextContent('72 sessions · 240 turns · 15.6B tokens'))
    await expect(canvas.findByText(/older sessions hidden/)).resolves.toBeVisible()
    await userEvent.click(canvas.getByRole('tab', { name: 'Tokens' }))
    await expect(stats()).toHaveTextContent('72 sessions · 240 turns · 15.6B tokens')
    await userEvent.click(canvas.getByLabelText('Project'))
    await userEvent.click(await within(document.body).findByRole('option', { name: 'ohmyc-desktop' }))
    await waitFor(() => expect(stats()).toHaveTextContent('12 sessions · 30 turns · 1.5B tokens'))
    await userEvent.click(canvas.getByLabelText('Year'))
    await userEvent.click(await within(document.body).findByRole('option', { name: String(new Date().getFullYear() - 1) }))
    await waitFor(() => expect(stats()).toHaveTextContent('0 sessions · 0 turns · 100 tokens'))
  },
}
