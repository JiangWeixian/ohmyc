import {
  Bot,
  Sparkles,
  TerminalSquare,
} from 'lucide-react'

import { EntityCard } from '@/components/entity-card'
import {
  entityBadges,
  entityDescriptions,
  entityOrigins,
} from '@/stories/fixtures/entities'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/EntityCard',
  component: EntityCard,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <div className="grid w-[860px] grid-cols-2 gap-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntityCard>

export default meta

type Story = StoryObj<typeof meta>

export const Variants: Story = {
  args: {
    icon: Bot,
    iconAccentVar: '--text-primary',
    title: 'review-agent',
    description: entityDescriptions.short,
    origins: entityOrigins,
    renderBadges: entityBadges,
    onClick: () => {},
  },
  render: () => (
    <>
      <EntityCard icon={Bot} iconAccentVar="--text-primary" title="review-agent" description={entityDescriptions.short} origins={entityOrigins} renderBadges={entityBadges} onClick={() => {}} />
      <EntityCard icon={Sparkles} iconAccentVar="--text-secondary" title="animation-review" description={entityDescriptions.long} origins={['claude']} onClick={() => {}} />
      <EntityCard icon={TerminalSquare} iconAccentVar="--text-tertiary" title="/ship" description="Runs the project shipping checklist." origins={['opencode']} onClick={() => {}} />
    </>
  ),
}
