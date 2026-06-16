import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { renderWithProviders } from '../../test/render-with-providers'
import { GeneralSettingsPanel } from '@/components/settings/general-settings'
import { SettingsContent } from '@/components/settings/settings-content'
import { SettingsLayout } from '@/components/settings/settings-layout'
import { __setTransportForTests, resetTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'

function fullGeneralSettings() {
  return {
    model: 'claude-opus-4-5-20250514',
    availableModels: ['claude-opus-4-5-20250514', 'claude-sonnet-4'],
    autoUpdatesChannel: 'stable',
    alwaysThinkingEnabled: false,
    showTurnDuration: true,
    prefersReducedMotion: false,
  }
}

beforeEach(() => {
  __setTransportForTests('mock')
})

afterEach(() => {
  resetMock()
  resetTransportForTests()
})

describe('GeneralSettingsPanel', () => {
  it('renders a create prompt when settings do not exist', async () => {
    let saved: unknown = null
    setMockHandler('settings.get', async () => ({ path: '/settings.json', content: null, exists: false }))
    setMockHandler('settings.set', async (args) => {
      saved = args
      return { success: true, path: '/settings.json' }
    })

    const user = userEvent.setup()
    renderWithProviders(<GeneralSettingsPanel />)

    const create = await screen.findByRole('button', { name: 'Create settings.json' })
    await user.click(create)

    await waitFor(() => expect(saved).not.toBeNull())
    expect((saved as { content?: unknown }).content).toEqual({
      general: {
        autoUpdatesChannel: 'stable',
        alwaysThinkingEnabled: false,
        showTurnDuration: false,
        prefersReducedMotion: false,
      },
    })
  })

  it('tracks edits and saves the merged general settings object', async () => {
    let saved: unknown = null
    setMockHandler('settings.get', async () => ({
      path: '/settings.json',
      exists: true,
      content: {
        general: fullGeneralSettings(),
        permissions: { allow: ['Read'] },
      },
    }))
    setMockHandler('settings.set', async (args) => {
      saved = args
      return { success: true, path: '/settings.json' }
    })

    const user = userEvent.setup()
    renderWithProviders(<GeneralSettingsPanel />)

    const modelInput = await screen.findByLabelText('Model')
    expect(screen.getByText('No changes')).toBeInTheDocument()

    await user.clear(modelInput)
    await user.type(modelInput, 'claude-sonnet-4')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(saved).not.toBeNull())
    expect((saved as { content?: { general?: { model?: string }; permissions?: unknown } }).content?.general?.model).toBe('claude-sonnet-4')
    expect((saved as { content?: { permissions?: unknown } }).content?.permissions).toEqual({ allow: ['Read'] })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('sets error status when saving fails and supports Cmd+S', async () => {
    setMockHandler('settings.get', async () => ({
      path: '/settings.json',
      exists: true,
      content: { general: fullGeneralSettings() },
    }))
    setMockHandler('settings.set', async () => {
      throw new Error('disk full')
    })

    const user = userEvent.setup()
    renderWithProviders(<GeneralSettingsPanel />)

    const modelInput = await screen.findByLabelText('Model')
    await user.clear(modelInput)
    await user.type(modelInput, 'claude-haiku')
    await user.keyboard('{Meta>}s{/Meta}')

    expect(await screen.findByText('Error saving')).toBeInTheDocument()
  })
})

describe('settings shell components', () => {
  it('routes implemented and placeholder categories from SettingsContent', async () => {
    setMockHandler('settings.get', async () => ({
      path: '/settings.json',
      exists: true,
      content: { general: fullGeneralSettings() },
    }))

    const { rerender } = renderWithProviders(<SettingsContent category="permissions" />)
    expect(screen.getByText('Coming soon')).toBeInTheDocument()

    rerender(<SettingsContent category="general" />)
    expect(await screen.findByText('Configure your general settings')).toBeInTheDocument()
  })

  it('switches categories through the settings sidebar', async () => {
    setMockHandler('settings.get', async () => ({
      path: '/settings.json',
      exists: true,
      content: { general: fullGeneralSettings() },
    }))

    const user = userEvent.setup()
    renderWithProviders(<SettingsLayout />)

    expect(await screen.findByText('Configure your general settings')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Permissions/ }))
    await screen.findByText('Coming soon')
    await user.click(screen.getByRole('tab', { name: /General/ }))
    expect(await screen.findByText('Configure your general settings')).toBeInTheDocument()
  })
})
