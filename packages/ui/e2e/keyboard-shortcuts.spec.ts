import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:7335'

test.describe('Keyboard shortcuts', () => {
  test('g + keycap navigates to each tab', async ({ page }) => {
    await page.goto(`${BASE}/explore/timeline?scenario=ready`)
    // Wait for the ready-state shell so the global keydown listener is attached.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()

    const shortcuts: Array<[string, string]> = [
      ['m', '/explore/monitor'],
      ['a', '/explore/agents'],
      ['s', '/explore/skills'],
      ['c', '/explore/commands'],
      ['p', '/explore/plugins'],
      ['t', '/explore/timeline'],
    ]

    for (const [key, route] of shortcuts) {
      await page.keyboard.press('g')
      await page.keyboard.press(key)
      await expect(page).toHaveURL(new RegExp(`${route}$`))
    }
  })

  test('does not trigger when typing in command palette input', async ({ page }) => {
    await page.goto(`${BASE}/explore/timeline?scenario=ready`)
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()

    await page.keyboard.press('Meta+k')
    const input = page.locator('[cmdk-input]').first()
    await expect(input).toBeVisible()
    await input.fill('g agents')

    // Wait beyond the 1s prefix timeout to prove no navigation fires.
    await page.waitForTimeout(1500)

    await expect(page).toHaveURL(/\/explore\/timeline(?:\?|$)/)
    await page.keyboard.press('Escape')
  })
})
