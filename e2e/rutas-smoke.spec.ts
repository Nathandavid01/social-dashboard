import { test, expect, type ConsoleMessage, type Page } from '@playwright/test'
import { AREAS, ALWAYS_ALLOWED_PREFIXES } from '@/lib/auth/areas'
import { hasPermission } from '@/lib/auth/permissions'
import type { Permission } from '@/lib/auth/permissions'

/**
 * Smoke de TODA la app: cada pantalla abre, no revienta y no tira errores de
 * JavaScript.
 *
 * Existe porque la suite solo miraba dos pantallas: se podía tumbar Entregas,
 * Posting o Clientes y el pre-commit seguía verde. Esto no prueba flujos —
 * prueba que nada quedó roto de raíz, que es la regresión más común y la más
 * cara de descubrir en producción.
 *
 * Las rutas salen de AREAS (la misma fuente que el menú), así que una pantalla
 * nueva entra aquí sola.
 */

/** El usuario sembrado para los E2E. Solo se visitan las pantallas de su rol. */
const ROL = 'supervisor' as const

const RUTAS = [
  // /pending es la sala de espera de quien aún no tiene acceso: redirige.
  ...ALWAYS_ALLOWED_PREFIXES.filter((p) => p !== '/pending'),
  ...AREAS
    .filter((a) => !a.permission || hasPermission(ROL, a.permission as Permission))
    .map((a) => a.href),
]

/**
 * Ruido conocido que no es un fallo de la pantalla: extensiones, recursos
 * externos que staging no tiene y avisos de hidratación de terceros.
 */
const RUIDO = [
  /favicon/i,
  /net::ERR_/i,
  /Failed to load resource/i,
  /Download the React DevTools/i,
  /metricool/i, // staging no tiene credenciales de Metricool
  /sentry/i,
]

const esRuido = (t: string) => RUIDO.some((r) => r.test(t))

async function abrir(page: Page, ruta: string) {
  const errores: string[] = []
  const onConsole = (m: ConsoleMessage) => {
    if (m.type() === 'error' && !esRuido(m.text())) errores.push(m.text())
  }
  const onPageError = (e: Error) => {
    if (!esRuido(e.message)) errores.push(`excepción: ${e.message}`)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  const res = await page.goto(ruta, { waitUntil: 'domcontentloaded' })

  page.off('console', onConsole)
  page.off('pageerror', onPageError)
  return { status: res?.status() ?? 0, errores, url: page.url() }
}

test.describe('todas las pantallas abren', () => {
  for (const ruta of RUTAS) {
    test(`@smoke ${ruta}`, async ({ page }) => {
      const { status, errores, url } = await abrir(page, ruta)

      // 200: la pantalla se renderizó. Un 500 es una excepción en el servidor.
      expect(status, `${ruta} respondió ${status}`).toBeLessThan(400)

      // Que no rebote al login: sería sesión perdida, no una pantalla sana.
      expect(url, `${ruta} rebotó al login`).not.toContain('/login')

      // La pantalla de error de Next: la app se rindió al renderizar.
      await expect(
        page.getByText(/Application error: a (client|server)-side exception/i),
        `${ruta} cayó en la pantalla de error de Next`,
      ).toHaveCount(0)

      expect(errores, `${ruta} tiró errores de JS:\n${errores.join('\n')}`).toEqual([])
    })
  }
})
