import { test, expect, type Page } from '@playwright/test'
import { limpiarBorradores } from './helpers/staging-db'

/**
 * Escribir ideas — lo tecleado es del cliente que se está viendo.
 *
 * El bug: cambiar de pestaña de cliente navega dentro de la MISMA ruta, así que
 * React reusaba la tabla y lo escrito para un cliente terminaba guardado en el
 * siguiente. Con ratón de verdad y dos clientes, que es como se notó.
 */

const titulo = (page: Page) => page.getByLabel('Título de la idea 1')

/** Las pestañas de cliente de la pantalla (solo clientes agendados para grabar). */
async function pestanasDeCliente(page: Page) {
  return page.locator('nav a[href^="/escribir-ideas?c="]')
}

test.describe('/escribir-ideas', () => {
  test.beforeEach(async ({ page }) => {
    // La feature guarda borradores de verdad: sin limpiar, lo que escribe una
    // prueba aparece en la siguiente y el resultado depende del orden.
    await limpiarBorradores()
    await page.goto('/escribir-ideas')
    // level 1: el h2 de la tabla también dice "Escribir ideas · <cliente>".
    await expect(page.getByRole('heading', { level: 1, name: 'Escribir ideas' })).toBeVisible()
  })

  test('@smoke lo escrito para un cliente no se va con el siguiente', async ({ page }) => {
    const tabs = await pestanasDeCliente(page)
    const total = await tabs.count()
    test.skip(total < 2, 'hacen falta dos clientes agendados para grabar')

    await expect(titulo(page)).toBeVisible()
    await titulo(page).fill('Idea del primer cliente')
    // El autoguardado del borrador tarda 1,5 s tras dejar de teclear.
    await expect(page.getByText(/sin enviar/i)).toBeVisible()
    await page.waitForTimeout(2500)

    // Cambiar de cliente: la tabla tiene que venir limpia, no arrastrar lo anterior.
    await tabs.nth(1).click()
    await expect(titulo(page)).toHaveValue('')

    // Y al volver, lo suyo sigue ahí.
    await tabs.nth(0).click()
    await expect(titulo(page)).toHaveValue('Idea del primer cliente')
  })

  test('el aviso de "sin enviar" solo sale cuando hay algo escrito', async ({ page }) => {
    const tabs = await pestanasDeCliente(page)
    test.skip((await tabs.count()) === 0, 'no hay clientes agendados para grabar')

    await expect(page.getByText(/sin enviar/i)).toHaveCount(0)
    await titulo(page).fill('Algo')
    await expect(page.getByText(/sin enviar/i)).toBeVisible()
  })
})
