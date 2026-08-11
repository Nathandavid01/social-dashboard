import { test as setup, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Un login real contra staging, guardado en disco: los specs arrancan ya dentro
 * del dashboard en vez de repetir el formulario en cada prueba.
 */

const STORAGE = 'e2e/.auth/user.json'

function stagingEnv() {
  const text = readFileSync(resolve(process.cwd(), '.env.staging'), 'utf8')
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq > 0) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

setup('login en staging', async ({ page }) => {
  const env = stagingEnv()
  await page.goto('/login')
  await page.locator('#email').fill(env.E2E_USER_EMAIL)
  await page.locator('#password').fill(env.E2E_USER_PASSWORD)
  await page.getByRole('button', { name: /iniciar sesión|entrar|log in/i }).click()

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
  await expect(page).not.toHaveURL(/\/login/)

  await page.context().storageState({ path: STORAGE })
})
