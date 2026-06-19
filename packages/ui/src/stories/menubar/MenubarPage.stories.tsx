import { fireEvent, within } from 'storybook/test'

import { MenubarPage } from '@/components/menubar/menubar-page'
import {
  installTimelineHandlers,
  MenubarFrame,
  withMockTransport,
  withQueryClient,
} from '@/stories/decorators/storybook-decorators'
import { menubarSessions, menubarTokens } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const populatedHandlers = () => installTimelineHandlers({
  years: [2026],
  projects: ['ohmyc'],
  heatmapByMetric: {
    tokens: menubarTokens,
    sessions: menubarSessions,
  },
  events: { days: [] },
  status: { sessionCount: 9, lastSyncAt: Date.UTC(2026, 5, 19, 12, 0, 0) },
})

const emptyHandlers = () => installTimelineHandlers({
  years: [2026],
  projects: [],
  heatmapByMetric: {
    tokens: [],
    sessions: [],
  },
  events: { days: [] },
  status: { sessionCount: 0, lastSyncAt: null },
})

const meta = {
  title: 'Menubar/MenubarPage',
  component: MenubarPage,
  tags: ['test', 'autodocs'],
  decorators: [
    withQueryClient,
    Story => (
      <MenubarFrame>
        <Story />
      </MenubarFrame>
    ),
  ],
} satisfies Meta<typeof MenubarPage>

export default meta

type Story = StoryObj<typeof meta>

export const LineView: Story = {
  decorators: [withMockTransport(populatedHandlers)],
}

export const HeatmapView: Story = {
  decorators: [withMockTransport(populatedHandlers)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heatmap = await canvas.findByRole('tab', { name: 'Heatmap view' })
    fireEvent.click(heatmap)
  },
}

export const NoActivity: Story = {
  decorators: [withMockTransport(emptyHandlers)],
}
