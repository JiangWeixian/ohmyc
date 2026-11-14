// packages/ui/src/tests/theme-settings.test.tsx
import {
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { defaultResolvedSettings, registerMockSettings } from '@/lib/mock-settings'
import { __setTransportForTests } from '@/lib/transport'
import { resetMock, setMockHandler } from '@/lib/transport/mock'
import { ThemeProvider, useTheme } from '@/theme/theme-provider'

function Probe() {
  const { theme, intensity, sources } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="intensity">{intensity}</span>
      <span data-testid="theme-source">{sources.theme}</span>
      <span data-testid="intensity-source">{sources.intensity}</span>
    </div>
  )
}

describe('theme settings integration', () => {
  beforeEach(() => {
    localStorage.clear()
    __setTransportForTests('mock')
  })
  afterEach(() => {
    localStorage.clear()
    resetMock()
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.intensity
  })

  it('migrates localStorage theme when file has no theme', async () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'amber', intensity: 'calm' }))
    registerMockSettings()
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await waitFor(() => expect(screen.getByTestId('theme-source')).toHaveTextContent('settings'))
    expect(screen.getByTestId('theme')).toHaveTextContent('amber')
    expect(screen.getByTestId('intensity')).toHaveTextContent('calm')
  })

  it('does not migrate over an existing file theme', async () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'amber', intensity: 'calm' }))
    const resolved = defaultResolvedSettings()
    resolved.themeId = { value: 'monitor', source: 'settings', envVar: null }
    setMockHandler('settings.get', async () => resolved)
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await waitFor(() => expect(screen.getByTestId('theme-source')).toHaveTextContent('settings'))
    expect(screen.getByTestId('theme')).toHaveTextContent('monitor')
  })

  it('migrates intensity independently of id', async () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'amber', intensity: 'calm' }))
    registerMockSettings()
    const resolved = defaultResolvedSettings()
    resolved.themeId = { value: 'monitor', source: 'settings', envVar: null }
    setMockHandler('settings.get', async () => resolved)
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await waitFor(() => expect(screen.getByTestId('intensity-source')).toHaveTextContent('settings'))
    expect(screen.getByTestId('theme')).toHaveTextContent('monitor')
    expect(screen.getByTestId('intensity')).toHaveTextContent('calm')
  })

  it('falls back to default for unknown env theme id', async () => {
    const resolved = defaultResolvedSettings()
    resolved.themeId = { value: 'nonexistent', source: 'env', envVar: 'OHMYC_THEME' }
    setMockHandler('settings.get', async () => resolved)
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await waitFor(() => expect(screen.getByTestId('theme-source')).toHaveTextContent('env'))
    expect(screen.getByTestId('theme')).toHaveTextContent('phosphor')
  })

  it('re-reads settings on visibility change after an external update', async () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'phosphor', intensity: 'expressive' }))
    registerMockSettings()
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await waitFor(() => expect(screen.getByTestId('theme-source')).toHaveTextContent('settings'))
    expect(screen.getByTestId('theme')).toHaveTextContent('phosphor')
    // Another window changed the theme while this webview was suspended —
    // no settings:changed event reaches it, so visibility must self-heal.
    const resolved = defaultResolvedSettings()
    resolved.themeId = { value: 'amber', source: 'settings', envVar: null }
    setMockHandler('settings.get', async () => resolved)
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(screen.getByTestId('theme')).toHaveTextContent('amber'))
  })

  it('localStorage mode unchanged when settings.get fails', async () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'amber', intensity: 'calm' }))
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('theme')).toHaveTextContent('amber')
    expect(screen.getByTestId('intensity')).toHaveTextContent('calm')
    expect(screen.getByTestId('theme-source')).toHaveTextContent('default')
  })
})
