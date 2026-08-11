import { defineConfig, devices } from '@playwright/test'

/**
 * E2E contra STAGING, nunca contra producción.
 *
 * Staging = la app buildeada corriendo en localhost:3021 contra un Supabase de
 * staging con datos sembrados (`npm run staging:seed`). La config de staging
 * vive en `.env.staging` — ver `docs/STAGING.md`.
 *
 * `next start` usa un distDir propio (`.next-staging`) para no pelearse con el
 * `.next/` de `next dev`, que sigue siendo el de desarrollo.
 */

// Puerto PROPIO de los E2E: el 3021 es el staging que se levanta a mano para
// mirarlo en el navegador, y reusarlo hacía que la suite corriera contra un
// build viejo — pasaba verde sin haber visto el cambio.
const PORT = Number(process.env.E2E_PORT ?? 3022)
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

/** Smoke = lo mínimo que protege el commit; la suite completa corre en el merge. */
const smokeOnly = process.env.E2E_SMOKE === '1'

export default defineConfig({
  testDir: './e2e',
  // Un fallo en E2E es una regresión de producto: no se reintenta hasta que pase.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  grep: smokeOnly ? /@smoke/ : undefined,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  // Sin E2E_BASE_URL externo, Playwright levanta el staging él mismo.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run staging:serve',
        url: BASE_URL,
        env: { E2E_PORT: String(PORT) },
        // Nunca reusar: un servidor ya levantado sirve el build que tenía, no el
        // código de ahora. La suite tiene que ver SIEMPRE lo último.
        reuseExistingServer: false,
        timeout: 240_000,
        stdout: 'pipe',
        stderr: 'pipe',
      },
})
