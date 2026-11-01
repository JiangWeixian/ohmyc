import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  renderHook,
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

import { renderWithProviders } from '../../tests/test/render-with-providers'
import { useAppSettings, useUpdateSettings } from '@/hooks/use-app-settings'
import { registerMockSettings } from '@/lib/mock-settings'
import { __setTransportForTests } from '@/lib/transport'
import { resetMock } from '@/lib/transport/mock'

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function Demo() {
  const settings = useAppSettings()
  const update = useUpdateSettings()
  return (
    <div>
      <span data-testid="claude">{settings.data ? String(settings.data.providers.claude.value) : 'loading'}</span>
      <span data-testid="source">{settings.data?.providers.claude.source}</span>
      <button onClick={() => update({ quota: { providers: { claude: { enabled: true } } } })}>enable</button>
    </div>
  )
}

describe('useAppSettings', () => {
  beforeEach(() => {
    __setTransportForTests('mock')
    registerMockSettings()
  })
  afterEach(() => {
    resetMock()
  })

  it('returns defaults from settings.get', async () => {
    const { result } = renderHook(() => useAppSettings(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.providers.claude.value).toBe(false)
    expect(result.current.data?.providers.codex.value).toBe(true)
    expect(result.current.data?.quotaPollSecs.value).toBe(300)
    expect(result.current.data?.themeId.value).toBe('phosphor')
    expect(result.current.data?.quotaEnabled.value).toBe(true)
  })

  it('useUpdateSettings merges patch and updates cache', async () => {
    renderWithProviders(<Demo />)
    await waitFor(() => expect(screen.getByTestId('claude')).toHaveTextContent('false'))
    screen.getByRole('button', { name: 'enable' }).click()
    await waitFor(() => expect(screen.getByTestId('claude')).toHaveTextContent('true'))
    expect(screen.getByTestId('source')).toHaveTextContent('settings')
  })
})
