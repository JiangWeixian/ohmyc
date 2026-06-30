import { expect, test } from '@playwright/test'

const BASE = 'http://localhost:7335'

// The CommandPaletteProvider attaches its ⌘K listener in a useEffect once the
// ready-state shell mounts. Wait for a shell-level element before pressing the
// shortcut so the keydown never races ahead of mount.
async function openPalette(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/explore/timeline?scenario=ready`)
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  await page.keyboard.press('Meta+k')
  await expect(page.locator('[cmdk-input]').first()).toBeVisible()
}

test.describe('Command palette', () => {
  test('opens with Cmd+K and closes with Escape', async ({ page }) => {
    await openPalette(page)

    const dialog = page.locator('[cmdk-root], [role="dialog"]').first()
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
  })

  test('filter and navigate to Monitor', async ({ page }) => {
    await openPalette(page)

    const input = page.locator('[cmdk-input]').first()
    await input.fill('monitor')
    // cmdk highlights the first match; Enter runs its onSelect → navigate.
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/explore\/monitor$/)
  })

  test('shows Go to section with all nav items', async ({ page }) => {
    await openPalette(page)

    const list = page.locator('[cmdk-list]')
    await expect(list).toBeVisible()
    for (const label of ['Monitor', 'Timeline', 'Agents', 'Commands', 'Skills', 'Plugins']) {
      await expect(list.locator('[cmdk-item]', { hasText: label }).first()).toBeVisible()
    }
  })
})
