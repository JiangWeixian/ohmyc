import { TimelineView } from '@/components/timeline/timeline-view'
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
