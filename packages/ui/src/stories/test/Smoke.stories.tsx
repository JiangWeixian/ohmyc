import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Test/Smoke',
  tags: ['test'],
  render: () => (
    <div className="rounded-lg border border-[var(--border-default)] bg-white/[0.02] px-4 py-3 text-[var(--text-primary)]">
      Storybook is wired to OhMyC UI.
    </div>
  ),
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
