import {
  expect,
  fireEvent,
  waitFor,
  within,
} from 'storybook/test'

import {
  defaultResolvedSettings,
  mergeSettingsPatch,
  registerMockSettings,
} from '@/lib/mock-settings'
import { setMockHandler } from '@/lib/transport/mock'
import { SettingsPage } from '@/routes/settings-page'
import {
  installQuotaHandlers,
  installTimelineHandlers,
  withMockTransport,
  withQueryClient,
  withRouter,
} from '@/stories/decorators/storybook-decorators'
import { quotaSnapshots } from '@/stories/fixtures/quota'
import { menubarSessions, menubarTokens } from '@/stories/fixtures/timeline'
import { ThemeProvider } from '@/theme/theme-provider'

import type { Meta, StoryObj } from '@storybook/react-vite'

function installGalleryHandlers() {
  registerMockSettings()
  installTimelineHandlers({
    years: [2026],
    projects: ['ohmyc'],
    heatmapByMetric: {
      tokens: menubarTokens,
      sessions: menubarSessions,
      event_sessions: menubarSessions,
    },
    events: { days: [] },
    status: { sessionCount: 9, lastSyncAt: Date.UTC(2026, 5, 19, 12, 0, 0) },
  })
  installQuotaHandlers(quotaSnapshots())
}

const meta = {
  title: 'Product/SettingsPage',
  component: SettingsPage,
  tags: ['test', 'autodocs'],
  decorators: [
    withQueryClient,
    withRouter(['/explore/settings']),
    Story => <ThemeProvider><Story /></ThemeProvider>,
    withMockTransport(installGalleryHandlers),
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
    expect(canvas.queryByRole('heading', { name: 'Menu bar' })).not.toBeInTheDocument()
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

export const GalleryApply: Story = {
  decorators: [withMockTransport(() => {
    installGalleryHandlers()
    const calls: unknown[] = []
    setMockHandler('settings.set', async (args) => {
      calls.push(args)
      return mergeSettingsPatch(defaultResolvedSettings(), (args as { patch: Parameters<typeof mergeSettingsPatch>[1] }).patch)
    })
    ;(globalThis as { __galleryCalls?: unknown[] }).__galleryCalls = calls
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const calls = (globalThis as { __galleryCalls?: unknown[] }).__galleryCalls!
    await canvas.findByRole('heading', { name: 'Menu bar' })
    fireEvent.click(canvas.getByRole('button', { name: 'Next layout' }))
    await canvas.findByText('Bricks & Quota')
    expect(calls).toHaveLength(0)
    fireEvent.click(canvas.getByRole('button', { name: 'Use Bricks & Quota' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect((calls[0] as { patch: { menubar: { view: string } } }).patch.menubar.view).toBe('heatmap')
    await canvas.findByRole('button', { name: 'Bricks & Quota selected' })
    expect(canvas.queryByText('Applied: Bricks & Quota')).not.toBeInTheDocument()
    expect(canvas.queryByText('Changes the popover layout only. Quota polling stays on.')).not.toBeInTheDocument()
    expect(canvas.queryByText('A denser activity pattern for spotting streaks and quiet days.')).not.toBeInTheDocument()

    const preview = canvasElement.querySelector<HTMLElement>('[data-gallery-slide][data-position="active"] .menu-bar-preview')!
    fireEvent.pointerEnter(preview.closest('[data-gallery-slide]')!, { clientX: 800, clientY: 200, pointerType: 'mouse' })
    await waitFor(() => expect(preview).toHaveAttribute('data-tilting', 'true'))
    expect(Number(getComputedStyle(preview, '::before').zIndex)).toBeGreaterThanOrEqual(1)
    expect(getComputedStyle(preview, '::before').backgroundImage).toContain('radial-gradient')
    expect(getComputedStyle(preview, '::after').backgroundImage).toContain('radial-gradient')
    await waitFor(() => expect(Number(getComputedStyle(preview, '::before').opacity)).toBeGreaterThan(0.9))

    fireEvent.keyDown(canvas.getByLabelText(/Available layouts/), { key: 'ArrowRight' })
    await canvas.findByText('Quota Focus')
    const region = canvas.getByRole('region', { name: 'Quota providers, scrollable' })
    region.style.maxHeight = '40px'
    expect(region.scrollHeight).toBeGreaterThan(region.clientHeight)
    region.focus()
    fireEvent.keyDown(region, { key: 'PageDown' })
    expect(region.scrollTop).toBeGreaterThan(0)
    expect(canvas.queryByRole('button', { name: 'Open OhMyC →' })).not.toBeInTheDocument()
    const quotaPreview = canvasElement.querySelector<HTMLElement>('[data-gallery-slide][data-position="active"] .menu-bar-preview')!
    const openLabel = quotaPreview.querySelector<HTMLElement>('.menubar-open')!
    expect(quotaPreview.getBoundingClientRect().bottom - openLabel.getBoundingClientRect().bottom).toBeLessThan(40)
    delete (globalThis as { __galleryCalls?: unknown[] }).__galleryCalls
  },
}

export const GalleryDuplicateApply: Story = {
  decorators: [withMockTransport(() => {
    installGalleryHandlers()
    let calls = 0
    let finish: (() => void) | undefined
    setMockHandler('settings.set', async (args) => {
      calls += 1
      const patch = (args as { patch: Parameters<typeof mergeSettingsPatch>[1] }).patch
      await new Promise<void>((resolve) => {
        finish = () => {
          resolve()
        }
      })
      return mergeSettingsPatch(defaultResolvedSettings(), patch)
    })
    ;(globalThis as { __duplicateGallery?: { calls: () => number; finish: () => void } }).__duplicateGallery = {
      calls: () => calls,
      finish: () => finish?.(),
    }
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const state = (globalThis as { __duplicateGallery?: { calls: () => number; finish: () => void } }).__duplicateGallery!
    fireEvent.click(await canvas.findByRole('button', { name: 'Next layout' }))
    const apply = await canvas.findByRole('button', { name: 'Use Bricks & Quota' })
    fireEvent.click(apply)
    fireEvent.click(apply)
    await waitFor(() => expect(state.calls()).toBe(1))
    state.finish()
    await canvas.findByRole('button', { name: 'Bricks & Quota selected' })
    delete (globalThis as { __duplicateGallery?: unknown }).__duplicateGallery
  },
}

export const GalleryRejectedApply: Story = {
  decorators: [withMockTransport(() => {
    installGalleryHandlers()
    let attempts = 0
    let state = defaultResolvedSettings()
    setMockHandler('settings.get', async () => state)
    setMockHandler('settings.set', async (args) => {
      attempts += 1
      if (attempts === 1) {
        throw new Error('read-only settings')
      }
      state = mergeSettingsPatch(state, (args as { patch: Parameters<typeof mergeSettingsPatch>[1] }).patch)
      return state
    })
    ;(globalThis as { __rejectedGallery?: () => number }).__rejectedGallery = () => attempts
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const attempts = (globalThis as { __rejectedGallery?: () => number }).__rejectedGallery!
    fireEvent.click(await canvas.findByRole('button', { name: 'Next layout' }))
    fireEvent.click(canvas.getByRole('button', { name: 'Use Bricks & Quota' }))
    await canvas.findByText("Couldn't save menu bar view. Try again.")
    expect(canvas.queryByText('Applied: Trend & Quota')).not.toBeInTheDocument()
    expect(attempts()).toBe(1)
    fireEvent.click(canvas.getByRole('button', { name: 'Use Bricks & Quota' }))
    await canvas.findByRole('button', { name: 'Bricks & Quota selected' })
    expect(attempts()).toBe(2)
    delete (globalThis as { __rejectedGallery?: unknown }).__rejectedGallery
  },
}

export const GalleryEnvOverride: Story = {
  decorators: [withMockTransport(() => {
    installGalleryHandlers()
    const resolved = defaultResolvedSettings()
    resolved.menubarView = { value: 'area', source: 'env', envVar: 'OHMYC_MENUBAR_VIEW' }
    setMockHandler('settings.get', async () => resolved)
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    fireEvent.click(await canvas.findByRole('button', { name: 'Next layout' }))
    await canvas.findByText('Bricks & Quota')
    expect(canvas.getByRole('button', { name: 'Use Bricks & Quota' })).toBeDisabled()
    await canvas.findByText(/OHMYC_MENUBAR_VIEW/)
  },
}

function galleryViewSettings(view: 'area' | 'heatmap' | 'quota') {
  installGalleryHandlers()
  const resolved = defaultResolvedSettings()
  resolved.menubarView = { value: view, source: 'settings', envVar: null }
  setMockHandler('settings.get', async () => resolved)
}

export const GalleryInitialHeatmap: Story = {
  decorators: [withMockTransport(() => galleryViewSettings('heatmap'))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const carousel = await canvas.findByLabelText(/Available layouts/)
    await waitFor(() => {
      const slide = carousel.querySelector('[data-gallery-slide][data-position="active"]')!
      const carouselRect = carousel.getBoundingClientRect()
      const slideRect = slide.getBoundingClientRect()
      expect(Math.abs(slideRect.left + slideRect.width / 2 - (carouselRect.left + carouselRect.width / 2))).toBeLessThan(2)
    })
  },
}

export const GalleryInitialQuotaFocus: Story = {
  decorators: [withMockTransport(() => galleryViewSettings('quota'))],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const carousel = await canvas.findByLabelText(/Available layouts/)
    await waitFor(() => {
      const slide = carousel.querySelector('[data-gallery-slide][data-position="active"]')!
      const carouselRect = carousel.getBoundingClientRect()
      const slideRect = slide.getBoundingClientRect()
      expect(Math.abs(slideRect.left + slideRect.width / 2 - (carouselRect.left + carouselRect.width / 2))).toBeLessThan(2)
    })
  },
}

export const GalleryScrollFallback: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const carousel = await canvas.findByLabelText(/Available layouts/)
    const slides = carousel.querySelectorAll<HTMLElement>('[data-gallery-slide]')
    const second = slides[1]
    carousel.addEventListener('scrollend', event => event.stopImmediatePropagation(), true)
    carousel.scrollLeft = second.offsetLeft - (carousel.clientWidth - second.clientWidth) / 2
    fireEvent.scroll(carousel)
    await canvas.findByText('Bricks & Quota')
  },
}
