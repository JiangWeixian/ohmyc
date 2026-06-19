import { MonitorSpikeView } from '@/components/monitor-spike/monitor-spike-view'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/MonitorSpikeView',
  component: MonitorSpikeView,
  tags: ['test', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof MonitorSpikeView>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
