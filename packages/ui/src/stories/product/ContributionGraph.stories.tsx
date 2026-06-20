import { ContributionGraph } from '@/components/timeline/contribution-graph'
import { timelineHeatmap } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/Timeline/ContributionGraph',
  component: ContributionGraph,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof ContributionGraph>

export default meta

type Story = StoryObj<typeof meta>

export const Activity: Story = {
  args: {
    year: 2026,
    metric: 'sessions',
    data: timelineHeatmap,
    onSelectDay: () => {},
  },
}

export const Tokens: Story = {
  args: {
    year: 2026,
    metric: 'tokens',
    data: timelineHeatmap,
    onSelectDay: () => {},
  },
}
