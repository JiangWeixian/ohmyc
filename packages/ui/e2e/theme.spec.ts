import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:7335'
const THEMES = [
  { name: 'Monitor', id: 'monitor' },
  { name: 'Phosphor Mono', id: 'phosphor' },
  { name: 'Amber CRT', id: 'amber' },
  { name: 'Retro Wave', id: 'retro' },
  { name: 'Cyberpunk', id: 'cyberpunk' },
]
const INTENSITIES = [
  { label: 'Calm', id: 'calm' },
  { label: 'Expressive', id: 'expressive' },
]

// Command-palette theme/intensity commands are labeled "Theme: <name>" and
// "Intensity: <Name>". Wait for the ready-state shell before pressing ⌘K so the
// keydown listener is mounted, and target the full labels to avoid colliding
// with the "Go to" nav items (e.g. bare "Monitor" matches both).
async function openPalette(page: import('@playwright/test').Page) {
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await page.keyboard.press('Meta+k')
  await expect(page.locator('[cmdk-input]').first()).toBeVisible()
}

test.describe('Theme switching', () => {
  test('switching theme updates data-theme attribute', async ({ page }) => {
    await page.goto(`${BASE}/explore/timeline?scenario=ready`)

    for (const theme of THEMES) {
      await openPalette(page)
      const input = page.locator('[cmdk-input]').first()
      await input.fill(theme.name)
      // Pick the "Theme: <name>" item, not the Go-to nav item.
      await page.locator('[cmdk-item]', { hasText: `Theme: ${theme.name}` }).first().click()

      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id)
    }
  })

  test('theme persists in localStorage', async ({ page }) => {
    await page.goto(`${BASE}/explore/timeline?scenario=ready`)

    await openPalette(page)
    const input = page.locator('[cmdk-input]').first()
    await input.fill('Amber CRT')
    await page.locator('[cmdk-item]', { hasText: 'Theme: Amber CRT' }).first().click()

    const stored = await page.evaluate(() => localStorage.getItem('ohmyc-theme'))
    expect(stored).toContain('"theme":"amber"')
  })

  test('theme survives page reload', async ({ page }) => {
    await page.goto(`${BASE}/explore/timeline?scenario=ready`)

    await openPalette(page)
    const input = page.locator('[cmdk-input]').first()
    await input.fill('Retro Wave')
    await page.locator('[cmdk-item]', { hasText: 'Theme: Retro Wave' }).first().click()

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'retro')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'retro')
  })

  test('switching intensity updates data-intensity attribute', async ({ page }) => {
    await page.goto(`${BASE}/explore/timeline?scenario=ready`)

    for (const intensity of INTENSITIES) {
      await openPalette(page)
      const input = page.locator('[cmdk-input]').first()
      await input.fill(intensity.label)
      await page.locator('[cmdk-item]', { hasText: `Intensity: ${intensity.label}` }).first().click()

      await expect(page.locator('html')).toHaveAttribute('data-intensity', intensity.id)
    }
  })
})
