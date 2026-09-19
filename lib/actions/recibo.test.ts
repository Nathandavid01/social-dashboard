import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateEq = vi.fn()
const update = vi.fn(() => ({ eq: updateEq }))
const from = vi.fn(() => ({ update }))

const getEntregaVideoEditado = vi.fn()
const getEntregasPreviewUrl = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from })),
}))
vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => undefined),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('@/lib/actions/entregas-r2', () => ({
  getEntregaVideoEditado: (...a: unknown[]) => getEntregaVideoEditado(...a),
  getEntregasPreviewUrl: (...a: unknown[]) => getEntregasPreviewUrl(...a),
}))

describe('recibo manual flags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateEq.mockResolvedValue({ error: null })
  })

  it('setManualPostedStatus writes posted', async () => {
    const { setManualPostedStatus } = await import('./recibo')
    const res = await setManualPostedStatus({ ideaId: 'i1', status: 'posted' })
    expect(res.ok).toBe(true)
    expect(from).toHaveBeenCalledWith('content_ideas')
    expect(update).toHaveBeenCalledWith({ manual_posted_status: 'posted' })
    expect(updateEq).toHaveBeenCalledWith('id', 'i1')
  })

  it('setStaffClientApproval writes approved', async () => {
    const { setStaffClientApproval } = await import('./recibo')
    const res = await setStaffClientApproval({ ideaId: 'i2', status: 'approved' })
    expect(res.ok).toBe(true)
    expect(update).toHaveBeenCalledWith({ staff_client_approval: 'approved' })
  })

  it('rejects invalid posted status', async () => {
    const { setManualPostedStatus } = await import('./recibo')
    const res = await setManualPostedStatus({
      ideaId: 'i1',
      status: 'weird' as 'posted',
    })
    expect(res.error).toBeTruthy()
    expect(update).not.toHaveBeenCalled()
  })
})

describe('getReciboIdeaPreviewUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves edited id then returns Entregas preview URL', async () => {
    getEntregaVideoEditado.mockResolvedValue({ id: 'vid-edit' })
    getEntregasPreviewUrl.mockResolvedValue({ url: 'https://signed.example/v.mp4' })
    const { getReciboIdeaPreviewUrl } = await import('./recibo')
    const res = await getReciboIdeaPreviewUrl('idea-1')
    expect(getEntregaVideoEditado).toHaveBeenCalledWith('idea-1')
    expect(getEntregasPreviewUrl).toHaveBeenCalledWith('vid-edit')
    expect(res.url).toBe('https://signed.example/v.mp4')
  })

  it('returns Sin video editado when none exists', async () => {
    getEntregaVideoEditado.mockResolvedValue({ id: null })
    const { getReciboIdeaPreviewUrl } = await import('./recibo')
    const res = await getReciboIdeaPreviewUrl('idea-2')
    expect(res.error).toMatch(/Sin video editado/i)
    expect(getEntregasPreviewUrl).not.toHaveBeenCalled()
  })
})
