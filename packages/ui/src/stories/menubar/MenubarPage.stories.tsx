import {
  expect,
  fireEvent,
  within,
} from 'storybook/test'

import { MenubarPage } from '@/components/menubar/menubar-page'
import { setMockHandler } from '@/lib/transport/mock'
import {
  installQuotaHandlers,
  installTimelineHandlers,
  MenubarFrame,
  withMockTransport,
  withQueryClient,
} from '@/stories/decorators/storybook-decorators'
import { quotaSnapshots } from '@/stories/fixtures/quota'
import { menubarSessions, menubarTokens } from '@/stories/fixtures/timeline'

import type { Meta, StoryObj } from '@storybook/react-vite'

const populatedHandlers = () => {
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
  setMockHandler('setup.status', async () => ({ state: 'ready' }))
}

const emptyHandlers = () => {
  installTimelineHandlers({
    years: [2026],
    projects: [],
    heatmapByMetric: {
      tokens: [],
      sessions: [],
      event_sessions: [],
    },
    events: { days: [] },
    status: { sessionCount: 0, lastSyncAt: null },
  })
  setMockHandler('setup.status', async () => ({ state: 'ready' }))
}

const meta = {
  title: 'Menubar/MenubarPage',
  component: MenubarPage,
  tags: ['test', 'autodocs'],
  decorators: [
    withQueryClient,
    Story => (
      <MenubarFrame>
        <Story />
      </MenubarFrame>
    ),
  ],
} satisfies Meta<typeof MenubarPage>

export default meta

type Story = StoryObj<typeof meta>

export const AreaView: Story = {
  decorators: [withMockTransport(populatedHandlers)],
  play: async ({ canvasElement }) => {
    // Quota section: provider names must label each block — a past edit
    // dropped the name row and left bare 5H/WK bars.
    const canvas = within(canvasElement)
    await canvas.findByText('GLM')
    await canvas.findByText('Codex')
    await canvas.findByText('Claude')
  },
}

export const HeatmapView: Story = {
  decorators: [withMockTransport(populatedHandlers)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heatmap = await canvas.findByRole('tab', { name: 'Heatmap view' })
    fireEvent.click(heatmap)
  },
}

export const EventSessionsTooltips: Story = {
  decorators: [withMockTransport(() => {
    const today = new Date()
    const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
    installTimelineHandlers({
      years: [today.getFullYear()],
      projects: ['ohmyc'],
      heatmapByMetric: {
        tokens: [{ date, value: 15_000 }],
        sessions: [{ date, value: 5 }],
        event_sessions: [{ date, value: 2 }],
      },
      events: { days: [] },
      status: { sessionCount: 5, lastSyncAt: null },
    })
    setMockHandler('setup.status', async () => ({ state: 'ready' }))
  })],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText('5')
    canvas.getByRole('application').focus()
    await expect(canvas.findByText('2 sessions · 15K tokens')).resolves.toBeVisible()
    await expect(canvasElement.querySelector('[data-kpi="sessions"]')).toHaveTextContent('5')
    fireEvent.click(canvas.getByRole('tab', { name: 'Heatmap view' }))
    fireEvent.mouseOver(canvasElement.querySelectorAll('[data-heat-cell]')[111])
    await expect(canvas.findByText('2 sessions · 15K tokens')).resolves.toBeVisible()
    await expect(canvasElement.querySelector('[data-kpi="sessions"]')).toHaveTextContent('5')
  },
}

export const NoActivity: Story = {
  decorators: [withMockTransport(emptyHandlers)],
}

const missingStoreHandlers = () => {
  setMockHandler('setup.status', async () => ({ state: 'missing_store' }))
}

const internalErrorHandlers = () => {
  setMockHandler('setup.status', async () => ({ state: 'internal_error' }))
}

export const Onboarding: Story = {
  decorators: [withMockTransport(missingStoreHandlers)],
}

export const SetupError: Story = {
  decorators: [withMockTransport(internalErrorHandlers)],
}
