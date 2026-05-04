import { screen, waitFor } from '@testing-library/react'
import React from 'react'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { usePlugins } from '@/hooks/use-plugins.ts'

function HookProbe() {
  const { data = [], isLoading } = usePlugins()

  if (isLoading) {
    return <div>Loading...</div>
  }

  return <pre data-testid="plugins">{JSON.stringify(data, null, 2)}</pre>
}

describe('usePlugins', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes enabled plugins with populated component arrays', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        plugins: [
          {
            id: 'review-pack@market',
            name: 'review-pack',
            marketplace: 'market',
            enabled: true,
            installs: [{ version: '1.0.0', installedAt: '', lastUpdated: '', installPath: '', scope: 'user' }],
            manifest: null,
            components: {
              agents: ['reviewer'],
              skills: ['lint', 'triage'],
              commands: ['ship'],
            },
          },
        ],
      }),
    } as Response)

    renderWithProviders(<HookProbe />)

    await waitFor(() => expect(screen.getByTestId('plugins')).toBeInTheDocument())
    const output = screen.getByTestId('plugins').textContent ?? ''

    expect(output).toContain('"id": "review-pack@market"')
    expect(output).toContain('"enabled": true')
    expect(output).toContain('"agents": 1')
    expect(output).toContain('"skills": 2')
    expect(output).toContain('"commands": 1')
  })

  it('normalizes disabled plugins when installs or component collections are sparse', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        plugins: [
          {
            id: 'empty-pack@market',
            name: 'empty-pack',
            marketplace: 'market',
            enabled: undefined,
            installs: undefined,
            manifest: null,
            components: {
              skills: ['lint'],
            },
          },
        ],
      }),
    } as Response)

    renderWithProviders(<HookProbe />)

    await waitFor(() => expect(screen.getByTestId('plugins')).toBeInTheDocument())
    const output = screen.getByTestId('plugins').textContent ?? ''

    expect(output).toContain('"id": "empty-pack@market"')
    expect(output).toContain('"enabled": false')
    expect(output).toContain('"installs": []')
    expect(output).toContain('"agents": 0')
    expect(output).toContain('"skills": 1')
    expect(output).toContain('"commands": 0')
  })
})
