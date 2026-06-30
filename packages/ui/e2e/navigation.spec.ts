import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:7335'

test.describe('Navigation', () => {
  test('lands on timeline by default', async ({ page }) => {
    await page.goto(`${BASE}/?scenario=ready`)
    await expect(page).toHaveURL(/\/explore\/timeline$/)
  })

  test('navigates to each tab via NavigationIsland', async ({ page }) => {
    await page.goto(`${BASE}/explore/timeline?scenario=ready`)

    const tabs = [
      { label: 'Monitor', path: '/explore/monitor' },
      { label: 'Agents', path: '/explore/agents' },
      { label: 'Skills', path: '/explore/skills' },
      { label: 'Commands', path: '/explore/commands' },
      { label: 'Plugins', path: '/explore/plugins' },
    ]

    for (const tab of tabs) {
      // The NavigationIsland collapses its labeled links until hovered.
      // Hover the rail first so the NavLink becomes pointer-interactive.
      const rail = page.getByRole('navigation', { name: 'Primary' })
      await rail.hover()
      const link = rail.locator(`a[href="${tab.path}"]`).first()
      await link.click()
      await expect(page).toHaveURL(new RegExp(`${tab.path}$`))
    }
  })

  test('all six routes are directly reachable', async ({ page }) => {
    const routes = [
      '/explore/monitor',
      '/explore/timeline',
      '/explore/agents',
      '/explore/commands',
      '/explore/skills',
      '/explore/plugins',
    ]

    for (const route of routes) {
      await page.goto(`${BASE}${route}?scenario=ready`)
      await expect(page).toHaveURL(new RegExp(String.raw`${route}(?:\?|$)`))
    }
  })
})
