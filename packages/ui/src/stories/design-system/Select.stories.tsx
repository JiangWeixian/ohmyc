import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Select',
  component: Select,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Open: Story = {
  render: () => (
    <Select defaultValue="tokens" open>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Metric" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="activity">Activity</SelectItem>
        <SelectItem value="tokens">Tokens</SelectItem>
        <SelectItem value="turns">Turns</SelectItem>
      </SelectContent>
    </Select>
  ),
}
