import { DualLineChart } from '@/components/menubar/dual-line-chart'
import { MenubarFrame } from '@/stories/decorators/storybook-decorators'
import { menubarSessions, menubarTokens } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Menubar/DualLineChart',
  component: DualLineChart,
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
} satisfies Meta<typeof DualLineChart>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    tokens: menubarTokens,
    sessions: menubarSessions,
  },
}
