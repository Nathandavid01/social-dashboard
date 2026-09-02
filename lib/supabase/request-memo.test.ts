import { describe, it, expect, vi, beforeEach } from 'vitest'

let currentStore: object | null = {}
vi.mock('next/headers', () => ({
  cookies: async () => {
    if (!currentStore) throw new Error('fuera de request')
    return currentStore
  },
}))

import { memoPerRequest, invalidateRequestMemo } from './request-memo'

beforeEach(() => {
  currentStore = {}
})

describe('memoPerRequest', () => {
  it('ejecuta fn una sola vez por request y clave', async () => {
    const fn = vi.fn(async () => 'v')
    const [a, b] = await Promise.all([memoPerRequest('k', fn), memoPerRequest('k', fn)])
    expect(a).toBe('v')
    expect(b).toBe('v')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('claves distintas no comparten resultado', async () => {
    const f1 = vi.fn(async () => 1)
    const f2 = vi.fn(async () => 2)
    expect(await memoPerRequest('a', f1)).toBe(1)
    expect(await memoPerRequest('b', f2)).toBe(2)
    expect(f1).toHaveBeenCalledTimes(1)
    expect(f2).toHaveBeenCalledTimes(1)
  })

  it('un request nuevo vuelve a ejecutar fn', async () => {
    const fn = vi.fn(async () => 'v')
    await memoPerRequest('k', fn)
    currentStore = {}
    await memoPerRequest('k', fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('no memoiza un rechazo: el siguiente intento vuelve a ejecutar', async () => {
    const fn = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok')
    await expect(memoPerRequest('k', fn)).rejects.toThrow('boom')
    expect(await memoPerRequest('k', fn)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('invalidateRequestMemo limpia todo el scope del request', async () => {
    const fn = vi.fn(async () => 'v')
    await memoPerRequest('k', fn)
    await invalidateRequestMemo()
    await memoPerRequest('k', fn)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('fuera de un request (sin cookies()) ejecuta sin memoizar y no lanza', async () => {
    currentStore = null
    const fn = vi.fn(async () => 'v')
    expect(await memoPerRequest('k', fn)).toBe('v')
    expect(await memoPerRequest('k', fn)).toBe('v')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
