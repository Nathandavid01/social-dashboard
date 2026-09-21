import { expect, test } from '@playwright/test'

/**
 * Auth-aware /pool smoke. Unauthenticated redirect to login is OK.
 * 500 (missing env, crashed page) is not. Login check only if staging
 * owner password is already present — no new secrets.
 */
test.describe('smoke /pool', () => {
  test('GET /api/health/pool no es 500', async ({ request }) => {
    const res = await request.get('/api/health/pool')
    expect(res.status(), `health /pool HTTP ${res.status()}`).toBeLessThan(500)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.route).toBe('/pool')
  })

  test('GET /pool no es 500 (redirect a login vale)', async ({ page }) => {
    const res = await page.goto('/pool', { waitUntil: 'domcontentloaded' })
    expect(res, 'navegación a /pool').not.toBeNull()
    expect(res!.status(), `/pool HTTP ${res!.status()}`).toBeLessThan(500)
    const path = new URL(page.url()).pathname
    expect(['/pool', '/login', '/pending']).toContain(path)
  })

  test('owner abre Panel si hay STAGING_OWNER_PASSWORD', async ({ page }) => {
    const password = process.env.STAGING_OWNER_PASSWORD
    test.skip(!password, 'sin STAGING_OWNER_PASSWORD — no se piden secretos nuevos')

    const email = process.env.STAGING_OWNER_EMAIL ?? 'eric.perez.pr@gmail.com'
    await page.goto('/login')
    await page.locator('#email').fill(email)
    await page.locator('#password').fill(password!)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
    await page.getByRole('button', { name: /Más tarde/i }).click({ timeout: 5_000 }).catch(() => {})

    const res = await page.goto('/pool', { waitUntil: 'domcontentloaded' })
    expect(res!.status()).toBeLessThan(500)
    await expect(page).toHaveURL(/\/pool/)
  })
})
