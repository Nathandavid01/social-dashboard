import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  perm: 'posting.read' as string | null,
  result: { updated: 1, checked: 2 } as { updated: number; checked: number; error?: string },
  run: vi.fn(async () => h.result),
  revalidate: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async (perm: string) => {
    if (h.perm && h.perm !== perm) throw new Error('No autorizado')
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => h.revalidate(...a) }))
vi.mock('@/lib/metricool/pool-publicado-sync', () => ({
  runPoolPublicadoSync: () => h.run(),
}))

import { syncPoolPublicado } from './pool-publicado-sync'

beforeEach(() => {
  h.perm = 'posting.read'
  h.result = { updated: 1, checked: 2 }
  h.run.mockClear()
  h.revalidate.mockClear()
})

describe('syncPoolPublicado', () => {
  it('exige posting.read (quien ve el Panel) y revalida /pool al marcar Publicado', async () => {
    const res = await syncPoolPublicado()
    expect(res.updated).toBe(1)
    expect(h.run).toHaveBeenCalledTimes(1)
    expect(h.revalidate).toHaveBeenCalledWith('/pool')
    expect(h.revalidate).toHaveBeenCalledWith('/calendar')
    expect(h.revalidate).toHaveBeenCalledWith('/recibo')
  })

  it('no revalida si Metricool no cambió nada (idempotente)', async () => {
    h.result = { updated: 0, checked: 3 }
    const res = await syncPoolPublicado()
    expect(res.updated).toBe(0)
    expect(h.revalidate).not.toHaveBeenCalled()
  })

  it('bloquea a quien no puede ver el Panel', async () => {
    h.perm = 'other.perm'
    await expect(syncPoolPublicado()).rejects.toThrow(/autorizado/i)
    expect(h.run).not.toHaveBeenCalled()
  })
})
