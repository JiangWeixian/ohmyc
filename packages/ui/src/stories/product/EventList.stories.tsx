import { EventList } from '@/components/timeline/event-list'
import { longProjectTimelineDays, timelineDays } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/Timeline/EventList',
  component: EventList,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <div className="w-[980px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EventList>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    days: timelineDays,
  },
}

export const LongProjectTitle: Story = {
  args: {
    days: longProjectTimelineDays,
  },
}

export const Empty: Story = {
  args: {
    days: [],
  },
}
