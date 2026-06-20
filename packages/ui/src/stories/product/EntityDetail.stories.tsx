import { EntityDetail } from '@/components/entity-detail'
import { entityMarkdown, entityMeta } from '@/stories/fixtures/entities'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/EntityDetail',
  component: EntityDetail,
  tags: ['test', 'autodocs'],
  decorators: [
    Story => (
      <div className="w-[920px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntityDetail>

export default meta

type Story = StoryObj<typeof meta>

export const Editable: Story = {
  args: {
    title: 'agents',
    name: 'review-agent',
    description: 'A focused review agent for implementation changes.',
    content: entityMarkdown,
    meta: entityMeta,
    onBack: () => {},
    onEdit: () => {},
    onDelete: () => {},
  },
}

export const ProjectReadOnly: Story = {
  args: {
    title: 'agents',
    name: 'project-review-agent',
    description: 'A project-scoped agent surfaced as view-only.',
    content: entityMarkdown,
    meta: entityMeta,
    onBack: () => {},
    scope: 'project',
  },
}
