import { OnboardingGate } from '@/components/onboarding/onboarding-gate'
import { setMockHandler } from '@/lib/transport/mock'
import { withMockTransport, withQueryClient } from '@/stories/decorators/storybook-decorators'

import type { SetupStatus } from '@/hooks/use-setup-status'
import type { Meta, StoryObj } from '@storybook/react-vite'

function installSetupStatus(status: SetupStatus): () => void {
  return () => {
    setMockHandler('setup.status', async () => status)
  }
}

const meta = {
  title: 'Product/OnboardingGate',
  component: OnboardingGate,
  tags: ['test', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [withQueryClient],
} satisfies Meta<typeof OnboardingGate>

export default meta

type Story = StoryObj<typeof meta>

export const MissingStore: Story = {
  decorators: [withMockTransport(installSetupStatus({ state: 'missing_store' }))],
}

export const UnreadableStore: Story = {
  decorators: [withMockTransport(installSetupStatus({ state: 'unreadable_store' }))],
}

export const InternalError: Story = {
  decorators: [withMockTransport(installSetupStatus({ state: 'internal_error' }))],
}
