import { MonitorSpikeView } from '@/components/monitor-spike/monitor-spike-view'
import {
  installTimelineHandlers,
  withMockTransport,
  withQueryClient,
} from '@/stories/decorators/storybook-decorators'
import { timelineEventsResponse, timelineHeatmap } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const populatedHandlers = () => installTimelineHandlers({
  years: [2026],
  projects: ['ohmyc'],
  heatmapByMetric: {
    sessions: timelineHeatmap,
    tokens: timelineHeatmap,
    turns: timelineHeatmap,
  },
  events: timelineEventsResponse,
  status: { sessionCount: 3, lastSyncAt: Date.now() - 3 * 60_000 },
})

const meta = {
  title: 'Product/MonitorSpikeView',
  component: MonitorSpikeView,
  tags: ['test', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    withMockTransport(populatedHandlers),
    withQueryClient,
  ],
} satisfies Meta<typeof MonitorSpikeView>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
