import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * El registro de Sentry en el servidor.
 *
 * Next llama `register()` una vez por runtime y le dice cuál es por
 * `NEXT_RUNTIME`. Cargar la config equivocada es un fallo silencioso: Sentry
 * arranca, no se queja, y luego faltan la mitad de los errores. Por eso lo que
 * se prueba aquí es el despacho, no que "importe algo".
 */

const original = process.env.NEXT_RUNTIME

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_RUNTIME
  else process.env.NEXT_RUNTIME = original
  vi.doUnmock('./sentry.server.config')
  vi.doUnmock('./sentry.edge.config')
})

describe('instrumentation', () => {
  it('en el runtime de Node carga la config del servidor y NO la de edge', async () => {
    process.env.NEXT_RUNTIME = 'nodejs'
    const server = vi.fn()
    const edge = vi.fn()
    vi.doMock('./sentry.server.config', () => { server(); return {} })
    vi.doMock('./sentry.edge.config', () => { edge(); return {} })

    const { register } = await import('./instrumentation')
    await register()

    expect(server).toHaveBeenCalledTimes(1)
    expect(edge).not.toHaveBeenCalled()
  })

  it('en el runtime de edge carga la config de edge y NO la del servidor', async () => {
    process.env.NEXT_RUNTIME = 'edge'
    const server = vi.fn()
    const edge = vi.fn()
    vi.doMock('./sentry.server.config', () => { server(); return {} })
    vi.doMock('./sentry.edge.config', () => { edge(); return {} })

    const { register } = await import('./instrumentation')
    await register()

    expect(edge).toHaveBeenCalledTimes(1)
    expect(server).not.toHaveBeenCalled()
  })

  it('en un runtime desconocido no carga ninguna config en vez de reventar', async () => {
    process.env.NEXT_RUNTIME = 'algo-nuevo-de-next'
    const server = vi.fn()
    const edge = vi.fn()
    vi.doMock('./sentry.server.config', () => { server(); return {} })
    vi.doMock('./sentry.edge.config', () => { edge(); return {} })

    const { register } = await import('./instrumentation')
    await expect(register()).resolves.toBeUndefined()

    expect(server).not.toHaveBeenCalled()
    expect(edge).not.toHaveBeenCalled()
  })

  it('exporta onRequestError, que es como Next entrega los errores de petición', async () => {
    const mod = await import('./instrumentation')
    expect(typeof mod.onRequestError).toBe('function')
  })
})
