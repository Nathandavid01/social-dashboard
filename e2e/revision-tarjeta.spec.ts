import { test, expect, type Page } from '@playwright/test'

/**
 * /revision — el tablero se panea arrastrando, pero la tarjeta se abre con un
 * clic. Antes el mousedown empezaba un paneo cayera donde cayera: la deriva
 * normal del ratón al pulsar pasaba el umbral y el clic se lo tragaba el paneo,
 * así que la tarjeta no abría nunca. El unit test lo cubre con eventos
 * sintéticos; esto lo cubre con un ratón de verdad, que es donde se notó.
 */

/**
 * La pestaña "Sin día" lleva lo sembrado (idea sin publish_date). Si no está,
 * el seed no llegó: mejor fallar aquí y decirlo que seguir contra el día
 * equivocado y morir después en un locator que no explica nada.
 */
async function abrirSinDia(page: Page) {
  const tab = page.getByRole('button', { name: /sin día/i })
  await expect(tab, 'falta la pestaña "Sin día" — ¿corriste npm run staging:seed?').toBeVisible()
  await tab.first().click()
}

/** El overlay de revisión, por su botón de cierre: único y estable. */
const colaDeRevision = (page: Page) => page.getByRole('button', { name: 'Cerrar revisión' })

test.describe('/revision — abrir un video', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/revision')
    await expect(page.getByTestId('pipeline-scroll')).toBeVisible()
    await abrirSinDia(page)
  })

  test('@smoke un clic con la deriva normal del ratón abre la cola de revisión', async ({ page }) => {
    const card = page.locator('article').filter({ hasText: 'Cliente E2E' }).first()
    await expect(card).toBeVisible()

    // Un clic humano no es puntual: se pulsa, el ratón se corre unos píxeles y
    // se suelta. Es exactamente lo que el paneo se tragaba.
    const box = (await card.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2 + 3, { steps: 5 })
    await page.mouse.up()

    // La cola de revisión: reproductor + decisión.
    await expect(colaDeRevision(page)).toBeVisible({ timeout: 15_000 })
  })

  test('arrastrar el fondo del tablero sigue paneando, no abre nada', async ({ page }) => {
    const board = page.getByTestId('pipeline-scroll')
    const box = (await board.boundingBox())!

    // Zona baja de la columna: fondo, por debajo de las tarjetas.
    await page.mouse.move(box.x + 60, box.y + box.height - 30)
    await page.mouse.down()
    await page.mouse.move(box.x + 260, box.y + box.height - 30, { steps: 10 })
    await page.mouse.up()

    await expect(colaDeRevision(page)).toHaveCount(0)
  })
})
