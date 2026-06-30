import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:7335'

test.describe('Empty states', () => {
  test('agents page renders with no items', async ({ page }) => {
    await page.goto(`${BASE}/explore/agents?scenario=empty`)
    await expect(page.locator('main')).toBeVisible()
  })

  test('skills page renders with no items', async ({ page }) => {
    await page.goto(`${BASE}/explore/skills?scenario=empty`)
    await expect(page.locator('main')).toBeVisible()
  })

  test('commands page renders with no items', async ({ page }) => {
    await page.goto(`${BASE}/explore/commands?scenario=empty`)
    await expect(page.locator('main')).toBeVisible()
  })

  test('menubar shows activity view with empty data', async ({ page }) => {
    await page.goto(`${BASE}/menubar.html?scenario=empty`)
    await expect(page.locator('[data-menubar-page]')).toBeVisible()
    // Exact match: with no data the footer reads "no activity yet", which
    // would otherwise collide with the "Activity" title under substring match.
    await expect(page.getByText('Activity', { exact: true })).toBeVisible()
  })
})
