import { expect, test } from '@playwright/test'

test.describe('Empty states', () => {
  test('agents page shows empty state', async ({ page }) => {
    await page.goto('/explore/agents?scenario=empty')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No agents found' })).toBeVisible()
  })

  test('skills page shows empty state', async ({ page }) => {
    await page.goto('/explore/skills?scenario=empty')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No skills found' })).toBeVisible()
  })

  test('commands page shows empty state', async ({ page }) => {
    await page.goto('/explore/commands?scenario=empty')
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'No commands found' })).toBeVisible()
  })

  test('menubar shows activity view with empty data', async ({ page }) => {
    await page.goto('/menubar.html?scenario=empty')
    await expect(page.locator('[data-menubar-page]')).toBeVisible()
    await expect(page.getByText('Activity', { exact: true })).toBeVisible()
  })
})
