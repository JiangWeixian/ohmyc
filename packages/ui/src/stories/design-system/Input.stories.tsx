import { Input } from '@/components/ui/input'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Input',
  component: Input,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const States: Story = {
  render: () => (
    <div className="grid w-[360px] gap-3">
      <Input placeholder="Search commands..." />
      <Input value="readonly value" readOnly />
      <Input placeholder="Disabled input" disabled />
      <Input aria-invalid placeholder="Invalid input" />
    </div>
  ),
}
