import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Tabs',
  component: Tabs,
  tags: ['test', 'autodocs'],
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="activity" className="w-[420px]">
      <TabsList>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
      </TabsList>
      <TabsContent value="activity">Activity view content</TabsContent>
      <TabsContent value="tokens">Token view content</TabsContent>
      <TabsContent value="sessions">Session view content</TabsContent>
    </Tabs>
  ),
}
