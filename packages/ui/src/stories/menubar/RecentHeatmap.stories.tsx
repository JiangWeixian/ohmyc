import { RecentHeatmap } from '@/components/menubar/recent-heatmap'
import { MenubarFrame } from '@/stories/decorators/storybook-decorators'
import { menubarSessions, menubarTokens } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Menubar/RecentHeatmap',
  component: RecentHeatmap,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <MenubarFrame>
        <div className="p-6">
          <Story />
        </div>
      </MenubarFrame>
    ),
  ],
} satisfies Meta<typeof RecentHeatmap>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    tokens: menubarTokens,
    sessions: menubarSessions,
  },
}

export const Empty: Story = {
  args: {
    tokens: [],
    sessions: [],
  },
}
