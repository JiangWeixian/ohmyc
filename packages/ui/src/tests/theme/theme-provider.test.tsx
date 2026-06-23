// packages/ui/src/tests/theme/theme-provider.test.tsx
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { DEFAULT_INTENSITY, DEFAULT_THEME } from '@/theme/registry'
import { ThemeProvider, useTheme } from '@/theme/theme-provider'

function Probe() {
  const { theme, intensity } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="intensity">{intensity}</span>
    </div>
  )
}

function IntensitySetter() {
  const { intensity, setIntensity } = useTheme()
  return <button onClick={() => setIntensity(intensity === 'calm' ? 'expressive' : 'calm')}>toggle</button>
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.intensity
  })
  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.intensity
  })

  it('mounts default theme and intensity on <html>', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME)
    expect(document.documentElement.dataset.intensity).toBe(DEFAULT_INTENSITY)
    expect(screen.getByTestId('theme').textContent).toBe(DEFAULT_THEME)
  })

  it('reads persisted theme from localStorage on mount', () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'amber', intensity: 'calm' }))
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(document.documentElement.dataset.theme).toBe('amber')
    expect(document.documentElement.dataset.intensity).toBe('calm')
  })

  it('falls back to default on invalid persisted theme', () => {
    localStorage.setItem('ohmyc-theme', JSON.stringify({ theme: 'nonexistent', intensity: 'calm' }))
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME)
  })

  it('setIntensity updates <html> and persists', () => {
    render(<ThemeProvider><IntensitySetter /></ThemeProvider>)
    fireEvent.click(screen.getByText('toggle'))
    expect(document.documentElement.dataset.intensity).toBe('calm')
    expect(JSON.parse(localStorage.getItem('ohmyc-theme')!).intensity).toBe('calm')
  })
})
