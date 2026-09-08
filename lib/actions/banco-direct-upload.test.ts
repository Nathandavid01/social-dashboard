import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => undefined)
const revalidatePathMock = vi.fn()
const createContentIdeaManual = vi.fn(async (_input: { clientId: string; contentType: string; title: string }): Promise<{ idea?: { id: string }; error?: string }> => ({ idea: { id: 'idea-new' } }))
const saveContentIdea = vi.fn(async (_input: { clientId: string; contentType: string; title: string; theme?: string | null }): Promise<{ idea?: { id: string }; error?: string }> => ({ idea: { id: 'broll-lib' } }))
let existingLibrary: { id: string } | null = null

vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))
vi.mock('@/lib/actions/content-ideas', () => ({
  createContentIdeaManual: (input: { clientId: string; contentType: string; title: string }) => createContentIdeaManual(input),
  saveContentIdea: (input: { clientId: string; contentType: string; title: string; theme?: string | null }) => saveContentIdea(input),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    chain.select = self
    chain.eq = self
    chain.neq = self
    chain.maybeSingle = async () => ({ data: existingLibrary, error: null })
    return { from: () => chain }
  },
}))

import { createBankIdea, ensureClientBrollLibrary } from './banco-direct-upload'

beforeEach(() => {
  requirePermission.mockReset().mockResolvedValue(undefined)
  revalidatePathMock.mockReset()
  createContentIdeaManual.mockReset().mockResolvedValue({ idea: { id: 'idea-new' } })
  saveContentIdea.mockReset().mockResolvedValue({ idea: { id: 'broll-lib' } })
  existingLibrary = null
})

describe('createBankIdea', () => {
  it('exige video.upload', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await createBankIdea({ clientId: 'c1', title: 'Toma extra' })
    expect(res.error).toMatch(/autorizado/i)
    expect(createContentIdeaManual).not.toHaveBeenCalled()
  })

  it('no crea idea sin cliente o sin título', async () => {
    expect((await createBankIdea({ clientId: '  ', title: 'Toma' })).error).toMatch(/cliente/i)
    expect((await createBankIdea({ clientId: 'c1', title: '  ' })).error).toMatch(/título/i)
    expect(createContentIdeaManual).not.toHaveBeenCalled()
  })

  it('crea una idea de reel sin sesión de grabación y refresca el banco', async () => {
    const res = await createBankIdea({ clientId: 'c1', title: '  Toma extra  ' })
    expect(requirePermission).toHaveBeenCalledWith('video.upload')
    expect(createContentIdeaManual).toHaveBeenCalledWith({
      clientId: 'c1',
      contentType: 'R',
      title: 'Toma extra',
    })
    const payload = createContentIdeaManual.mock.calls[0]?.[0]
    expect(payload).not.toHaveProperty('recording_session_id')
    expect(revalidatePathMock).toHaveBeenCalledWith('/banco')
    expect(res.ideaId).toBe('idea-new')
    expect(res.error).toBeUndefined()
  })

  it('devuelve el error de creación', async () => {
    createContentIdeaManual.mockResolvedValueOnce({ error: 'falló supabase' })
    const res = await createBankIdea({ clientId: 'c1', title: 'Toma' })
    expect(res.error).toMatch(/falló supabase/)
    expect(res.ideaId).toBeUndefined()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('ensureClientBrollLibrary', () => {
  it('exige video.upload', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await ensureClientBrollLibrary({ clientId: 'c1', clientName: 'ARASIBO' })
    expect(res.error).toMatch(/autorizado/i)
    expect(saveContentIdea).not.toHaveBeenCalled()
  })

  it('reusa la librería si ya existe', async () => {
    existingLibrary = { id: 'already' }
    const res = await ensureClientBrollLibrary({ clientId: 'c1', clientName: 'ARASIBO' })
    expect(res.ideaId).toBe('already')
    expect(saveContentIdea).not.toHaveBeenCalled()
  })

  it('crea la idea sentinela de B-roll del cliente', async () => {
    const res = await ensureClientBrollLibrary({ clientId: 'c1', clientName: 'ARASIBO' })
    expect(saveContentIdea).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'c1',
      title: 'B-roll de ARASIBO',
      theme: 'client-broll-library',
    }))
    expect(res.ideaId).toBe('broll-lib')
    expect(revalidatePathMock).toHaveBeenCalledWith('/banco')
  })
})
