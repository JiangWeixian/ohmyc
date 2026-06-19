import { NativeButton } from '@/components/uitripled/native-button'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/NativeButton',
  component: NativeButton,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof NativeButton>

export default meta

type Story = StoryObj<typeof meta>

export const States: Story = {
  args: {
    children: 'Default',
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <NativeButton>Default</NativeButton>
      <NativeButton variant="outline">Outline</NativeButton>
      <NativeButton loading>Loading</NativeButton>
      <NativeButton disabled>Disabled</NativeButton>
    </div>
  ),
}
