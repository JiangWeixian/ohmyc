import { expect, test } from '@playwright/test'

test.describe('Onboarding gate', () => {
  test('shows onboarding when store is missing', async ({ page }) => {
    await page.goto('/?scenario=missing')

    await expect(page.locator('h1')).toHaveText('Monitor not connected')
    await expect(page.getByText('Install the OhMyC plugin')).toBeVisible()
    await expect(page.getByRole('button', { name: /check again/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /open install instructions/i })).toBeVisible()
  })

  test('shows error line for unreadable store', async ({ page }) => {
    await page.goto('/?scenario=unreadable')

    await expect(page.locator('h1')).toHaveText('Monitor not connected')
    await expect(page.getByText('Local monitor store exists but could not be opened.')).toBeVisible()
  })

  test('shows error line for internal error', async ({ page }) => {
    await page.goto('/?scenario=error')

    await expect(page.locator('h1')).toHaveText('Monitor not connected')
    await expect(page.getByText('OhMyC could not confirm the monitor connection. Install the plugin, then check again.')).toBeVisible()
  })

  test('redirects to timeline when ready', async ({ page }) => {
    await page.goto('/?scenario=ready')

    await expect(page).toHaveURL(/\/explore\/timeline$/)
  })

  test('retry button re-probes setup status', async ({ page }) => {
    await page.goto('/?scenario=missing')

    await expect(page.locator('h1')).toHaveText('Monitor not connected')

    // Switch scenario to ready, then run the setup check again.
    await page.evaluate(() => {
      ;(globalThis as unknown as { __e2eSetScenario: (n: string) => void }).__e2eSetScenario('ready')
    })

    await page.getByRole('button', { name: /check again/i }).click()

    await expect(page).toHaveURL(/\/explore\/timeline$/)
  })
})
