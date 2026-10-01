import { expect, within } from 'storybook/test'

import { QuotaView } from '@/components/quota/quota-view'
import {
  installQuotaHandlers,
  withMockTransport,
  withQueryClient,
} from '@/stories/decorators/storybook-decorators'
import { quotaSnapshots, quotaSnapshotsLoggedOut } from '@/stories/fixtures/quota'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/QuotaView',
  component: QuotaView,
  tags: ['test', 'autodocs'],
  decorators: [withQueryClient],
} satisfies Meta<typeof QuotaView>

export default meta

type Story = StoryObj<typeof meta>

/** All seven providers: multi-window, hot pace window, meters, state cards. */
export const AllStates: Story = {
  decorators: [withMockTransport(() => installQuotaHandlers(quotaSnapshots()))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('OpenCode Go')
    await canvas.findByText('Credentials expired')
    await canvas.findByText('No credentials found')
    // Hot Codex 5h window and Claude's weekly are both ahead of their pace
    // ticks — at least one pace note renders.
    const paceNotes = await canvas.findAllByText(/pace \+\d+% ahead — runs out before reset/)
    expect(paceNotes.length).toBeGreaterThan(0)
    // provenance markers
    expect(canvas.getByText('official')).toBeInTheDocument()
    expect(canvas.getAllByText('experimental').length).toBeGreaterThan(1)
  },
}

/** Every provider logged out — page-level empty-state note on top. */
export const LoggedOut: Story = {
  decorators: [withMockTransport(() => installQuotaHandlers(quotaSnapshotsLoggedOut()))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText(/sign in to a CLI to see its quota/)
    expect(canvas.getAllByText('not logged in')).toHaveLength(7)
  },
}
