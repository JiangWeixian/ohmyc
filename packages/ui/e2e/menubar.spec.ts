import { expect, test } from '@playwright/test'

const MENUBAR = '/menubar.html'

test.describe('Menubar popover', () => {
  test('shows activity view when ready', async ({ page }) => {
    await page.goto(`${MENUBAR}?scenario=ready`)

    await expect(page.locator('[data-menubar-page]')).toBeVisible()
    await expect(page.getByText('Activity', { exact: true })).toBeVisible()
  })

  test('renders heatmap from saved settings without a temporary switch', async ({ page }) => {
    await page.goto(`${MENUBAR}?scenario=readyHeatmap`)

    await expect(page.locator('[data-layout="heatmap"]')).toBeVisible()
    await expect(page.locator('[data-heat-cell]').first()).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Area chart view' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Heatmap view' })).toHaveCount(0)
  })

  test('renders quota focus from saved settings', async ({ page }) => {
    await page.goto(`${MENUBAR}?scenario=readyQuota`)

    await expect(page.locator('[data-layout="quota"]')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Quota providers, scrollable' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Area chart view' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Heatmap view' })).toHaveCount(0)
  })

  test('Open OhMyC button triggers invoke', async ({ page }) => {
    await page.goto(`${MENUBAR}?scenario=ready`)

    await expect(page.locator('[data-menubar-page]')).toBeVisible()

    await page.getByText('Open OhMyC').click()

    // The button's onClick does a dynamic import('@tauri-apps/api/core') then
    // invokes open_main_window. In vite dev that import is an async module
    // fetch, so poll until the recorded call lands rather than asserting
    // synchronously after click.
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const fn = (globalThis as unknown as { __e2eGetInvokeCalls?: (cmd: string) => unknown[] }).__e2eGetInvokeCalls
        return fn ? fn('open_main_window').length : 0
      })
    }, { timeout: 3000 }).toBe(1)
  })

  test('shows onboarding when store is missing (no duplicate images)', async ({ page }) => {
    await page.goto(`${MENUBAR}?scenario=missing`)

    await expect(page.getByText('Monitor not connected')).toBeVisible()

    // Regression guard for commit 1de9392: scene styles must position layers
    // absolutely. Without them, depth layers show as duplicate monitor images.
    const images = page.locator('.onboard-asset img')
    const count = await images.count()
    expect(count).toBeLessThanOrEqual(5)
  })
})
