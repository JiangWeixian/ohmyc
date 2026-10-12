import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Tooltip',
  component: Tooltip,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <div className="flex items-center justify-center p-24">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

/** The Quota header pattern: icon-only action, tooltip carries the label. */
export const IconAction: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Refresh quota now"
          className="inline-flex size-7 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw size={13} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        Refresh quota now
      </TooltipContent>
    </Tooltip>
  ),
}

/** Tooltip on a regular labelled button, shown above. */
export const OnButton: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent side="top">Runs immediately, no undo</TooltipContent>
    </Tooltip>
  ),
}

/** Force-open for visual review of the surface itself. */
export const ForcedOpen: Story = {
  render: () => (
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Refresh quota now">
          <RefreshCw />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        Refresh quota now
      </TooltipContent>
    </Tooltip>
  ),
}
