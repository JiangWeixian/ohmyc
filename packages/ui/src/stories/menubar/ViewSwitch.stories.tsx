import { useState } from 'react'

import { type MenubarView, ViewSwitch } from '@/components/menubar/view-switch'
import { MenubarFrame } from '@/stories/decorators/storybook-decorators'

import type { Meta, StoryObj } from '@storybook/react-vite'

function StatefulSwitch({ initial }: { initial: MenubarView }) {
  const [value, setValue] = useState<MenubarView>(initial)
  return <ViewSwitch value={value} onChange={setValue} />
}

const meta = {
  title: 'Menubar/ViewSwitch',
  component: ViewSwitch,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <MenubarFrame>
        <div className="flex justify-end p-6">
          <Story />
        </div>
      </MenubarFrame>
    ),
  ],
} satisfies Meta<typeof ViewSwitch>

export default meta

type Story = StoryObj<typeof meta>

export const Line: Story = {
  render: () => <StatefulSwitch initial="line" />,
}

export const Heatmap: Story = {
  render: () => <StatefulSwitch initial="heatmap" />,
}
