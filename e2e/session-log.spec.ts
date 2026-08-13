import { test, expect } from '@playwright/test'

function ownerCreds() {
  const email = process.env.STAGING_OWNER_EMAIL ?? 'eric.perez.pr@gmail.com'
  const password = process.env.STAGING_OWNER_PASSWORD
  if (!password) throw new Error('Falta STAGING_OWNER_PASSWORD')
  return { email, password }
}

function supervisorCreds() {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD
  if (!email || !password) throw new Error('Falta E2E_USER_EMAIL / E2E_USER_PASSWORD')
  return { email, password }
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  await page.getByRole('button', { name: /Más tarde/i }).click({ timeout: 5_000 }).catch(() => {})
}

test.describe('session log on staging', () => {
  test('owner clicks a page then sees it under Sesión', async ({ page }) => {
    const { email, password } = ownerCreds()
    await login(page, email, password)

    await page.getByRole('link', { name: 'Mi día' }).click()
    await expect(page).toHaveURL(/\/mi-dia/)

    await page.getByRole('link', { name: 'Actividad' }).click()
    await expect(page).toHaveURL(/\/actividad/)
    await expect(page.getByRole('tab', { name: 'Sesión' })).toBeVisible()
    await expect(page.getByText('Eric Pérez hizo click en Mi día').first()).toBeVisible()
  })

  test('supervisor can open Actividad but cannot see Sesión', async ({ page }) => {
    const { email, password } = supervisorCreds()
    await login(page, email, password)
    await page.goto('/actividad')
    await expect(page.getByRole('heading', { name: 'Actividad' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Sesión' })).toHaveCount(0)
  })
})
