import { describe, it, expect, vi, beforeEach } from 'vitest'
import { healVideoCover, oldEnoughToHeal, HEAL_MIN_AGE_MS, HEAL_RETRY_AFTER_MS, __resetCoverHealForTests } from './video-cover-heal'

beforeEach(() => {
  __resetCoverHealForTests()
  window.localStorage.clear()
})

describe('healVideoCover', () => {
  it('varias tarjetas del mismo video piden la carátula a la vez: se genera una sola vez', async () => {
    let resolve!: (v: { cover: string | null; saved: boolean }) => void
    const heal = vi.fn(() => new Promise<{ cover: string | null; saved: boolean }>((r) => { resolve = r }))
    const a = healVideoCover('vid-1', { heal })
    const b = healVideoCover('vid-1', { heal })
    resolve({ cover: 'data:image/jpeg;base64,A', saved: true })
    await expect(a).resolves.toBe('data:image/jpeg;base64,A')
    await expect(b).resolves.toBe('data:image/jpeg;base64,A')
    expect(heal).toHaveBeenCalledTimes(1)
  })

  it('si falla, no se vuelve a bajar el video en cada visita durante un día', async () => {
    const heal = vi.fn(async () => ({ cover: null, saved: false }))
    const now = 1_000_000
    await expect(healVideoCover('vid-2', { heal, now: () => now })).resolves.toBeNull()
    await expect(healVideoCover('vid-2', { heal, now: () => now + 60_000 })).resolves.toBeNull()
    expect(heal).toHaveBeenCalledTimes(1)

    await healVideoCover('vid-2', { heal, now: () => now + HEAL_RETRY_AFTER_MS + 1 })
    expect(heal).toHaveBeenCalledTimes(2)
  })

  it('un error inesperado cuenta como fallo, nunca rompe la tarjeta', async () => {
    const heal = vi.fn(async () => { throw new Error('boom') })
    await expect(healVideoCover('vid-3', { heal })).resolves.toBeNull()
  })

  it('sin localStorage (modo privado) igual funciona', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    try {
      const heal = vi.fn(async () => ({ cover: null, saved: false }))
      await expect(healVideoCover('vid-4', { heal })).resolves.toBeNull()
      const ok = vi.fn(async () => ({ cover: 'data:x', saved: true }))
      await expect(healVideoCover('vid-5', { heal: ok })).resolves.toBe('data:x')
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })

  it('si se ve pero no se pudo guardar (sin permiso), tampoco se vuelve a bajar en cada visita', async () => {
    const heal = vi.fn(async () => ({ cover: 'data:x', saved: false }))
    await expect(healVideoCover('vid-6', { heal })).resolves.toBe('data:x')
    await expect(healVideoCover('vid-6', { heal })).resolves.toBeNull()
    expect(heal).toHaveBeenCalledTimes(1)
  })

  it('con subidas en curso no arranca (ni se anota como fallo): se cura en la próxima visita', async () => {
    const heal = vi.fn(async () => ({ cover: 'data:x', saved: true }))
    await expect(healVideoCover('vid-7', { heal, busy: () => true })).resolves.toBeNull()
    expect(heal).not.toHaveBeenCalled()
    await expect(healVideoCover('vid-7', { heal, busy: () => false })).resolves.toBe('data:x')
  })
})

describe('healVideoCover — memoria de fallos', () => {
  it('un fallo pasajero no deja el crudo sin carátula un día entero: se reintenta a las pocas horas', () => {
    expect(HEAL_RETRY_AFTER_MS).toBeLessThanOrEqual(6 * 60 * 60 * 1000)
  })

  it('al curarla borra la marca de fallo (no acumula claves en el navegador)', async () => {
    const now = 5_000_000
    await healVideoCover('vid-8', { heal: async () => ({ cover: null, saved: false }), now: () => now })
    expect(window.localStorage.getItem('nm:caratula-fallida:vid-8')).not.toBeNull()
    await healVideoCover('vid-8', { heal: async () => ({ cover: 'data:x', saved: true }), now: () => now + HEAL_RETRY_AFTER_MS + 1 })
    expect(window.localStorage.getItem('nm:caratula-fallida:vid-8')).toBeNull()
  })
})

describe('oldEnoughToHeal', () => {
  const now = Date.parse('2026-09-23T16:00:00Z')

  it('un crudo recién subido no se cura: su carátula la está haciendo quien lo subió', () => {
    expect(oldEnoughToHeal('2026-09-23T15:50:00Z', now)).toBe(false)
  })

  it('pasados 15 minutos, sí', () => {
    expect(oldEnoughToHeal(new Date(now - HEAL_MIN_AGE_MS).toISOString(), now)).toBe(true)
    expect(oldEnoughToHeal('2026-09-14T01:55:00Z', now)).toBe(true)
  })

  it('sin fecha o con fecha ilegible cuenta como viejo', () => {
    expect(oldEnoughToHeal(null, now)).toBe(true)
    expect(oldEnoughToHeal(undefined, now)).toBe(true)
    expect(oldEnoughToHeal('no-es-fecha', now)).toBe(true)
  })
})
