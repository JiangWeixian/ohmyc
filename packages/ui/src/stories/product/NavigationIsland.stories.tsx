import { CommandPaletteProvider } from '@/components/command-palette'
import { NavigationIsland } from '@/components/navigation-island'
import { withRouter } from '@/stories/decorators/storybook-decorators'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/NavigationIsland',
  component: NavigationIsland,
  tags: ['test', 'autodocs'],
  decorators: [
    withRouter(['/explore/timeline']),
    Story => (
      <CommandPaletteProvider>
        <div className="h-[720px] w-[980px] bg-[var(--bg-marketing)]">
          <Story />
        </div>
      </CommandPaletteProvider>
    ),
  ],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NavigationIsland>

export default meta

type Story = StoryObj<typeof meta>

export const Expanded: Story = {}

export const Collapsed: Story = {}
