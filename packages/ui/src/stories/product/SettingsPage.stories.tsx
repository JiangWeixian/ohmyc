import {
  expect,
  waitFor,
  within,
} from 'storybook/test'

import { defaultResolvedSettings, registerMockSettings } from '@/lib/mock-settings'
import { setMockHandler } from '@/lib/transport/mock'
import { SettingsPage } from '@/routes/settings-page'
import {
  withMockTransport,
  withQueryClient,
  withRouter,
} from '@/stories/decorators/storybook-decorators'
import { ThemeProvider } from '@/theme/theme-provider'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Product/SettingsPage',
  component: SettingsPage,
  tags: ['test', 'autodocs'],
  decorators: [
    withQueryClient,
    withRouter(['/explore/settings']),
    Story => <ThemeProvider><Story /></ThemeProvider>,
    withMockTransport(() => registerMockSettings()),
  ],
} satisfies Meta<typeof SettingsPage>

export default meta

type Story = StoryObj<typeof meta>

/** All eight provider cards render; clicking an unselected card selects it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const claudeCard = await canvas.findByRole('button', { name: /^Claude/ })
    for (const name of ['Codex', 'Cursor', 'Gemini', 'GLM', 'Grok', 'Kimi', 'OpenCode Go']) {
      expect(canvas.getAllByText(name).length).toBeGreaterThan(0)
    }
    claudeCard.click()
    await canvas.findByTestId('provider-check-claude')
  },
}

/** Master switch off: the provider grid dims and becomes inert. */
export const MasterOff: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const master = await canvas.findByRole('button', { name: /enable quota polling/i })
    master.click()
    await waitFor(() => expect(canvas.getByTestId('provider-grid')).toHaveClass('all-off'))
    // Keyboard users can't toggle either: cards are natively disabled.
    expect(canvas.getByRole('button', { name: /^Claude/ })).toBeDisabled()
  },
}

/** No settings backend (e.g. plain web): only the theme cards render. */
export const NoBackend: Story = {
  decorators: [withMockTransport(() => {})],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('Phosphor Mono')
    expect(canvas.queryByText('Codex')).not.toBeInTheDocument()
  },
}

/** Env-overridden master switch: disabled control + the env var is named. */
export const EnvOverride: Story = {
  decorators: [
    withMockTransport(() => {
      const resolved = defaultResolvedSettings()
      resolved.quotaEnabled = { value: false, source: 'env', envVar: 'OHMYC_QUOTA_ENABLED' }
      setMockHandler('settings.get', async () => resolved)
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const master = await canvas.findByRole('button', { name: /enable quota polling/i })
    expect(master).toBeDisabled()
    await canvas.findByText(/OHMYC_QUOTA_ENABLED/)
  },
}
