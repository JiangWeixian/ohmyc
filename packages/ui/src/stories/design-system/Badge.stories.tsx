import { Badge } from '@/components/ui/badge'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Badge',
  component: Badge,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge>claude · opencode</Badge>
    </div>
  ),
}
