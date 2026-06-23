import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/ThemesShowcase',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Showcase: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h1
          className="deco-title-shadow text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          OhMyC Coding Monitor
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Switch Theme and Intensity in the toolbar.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
      <Card decorated className="p-6">
        <h3 className="mb-2 text-lg" style={{ fontFamily: 'var(--font-display)' }}>
          Decorated Card
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Expressive Cyberpunk: notched corners + glow. Calm: looks normal.
        </p>
      </Card>
      <div className="flex items-center gap-4">
        <Label htmlFor="si">Input</Label>
        <Input id="si" placeholder="Type here" className="max-w-xs" />
      </div>
      <div className="flex items-center gap-4">
        <Label htmlFor="ss">Switch</Label>
        <Switch id="ss" />
      </div>
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>
      </Tabs>
      <div>
        <h3 className="mb-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Heatmap buckets
        </h3>
        <div className="flex gap-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className={`h-3 w-3 rounded-sm heat-l${i % 5}`} />
          ))}
        </div>
      </div>
    </div>
  ),
}
