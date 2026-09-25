import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateEq = vi.fn()
const update = vi.fn(() => ({ eq: updateEq }))
const from = vi.fn(() => ({ update }))

const getEntregaVideoEditado = vi.fn()
const getEntregasPreviewUrl = vi.fn()
const getEntregasDownloadUrl = vi.fn()

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
  getEntregasDownloadUrl: (...a: unknown[]) => getEntregasDownloadUrl(...a),
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

  it('rejects a newer file uploaded after the exact-cut card was rendered', async () => {
    getEntregaVideoEditado.mockResolvedValue({ id: 'v8' })
    getEntregasPreviewUrl.mockResolvedValue({ url: 'https://signed.example/v8.mp4' })
    const { getReciboIdeaPreviewUrl } = await import('./recibo')
    const res = await getReciboIdeaPreviewUrl('outfit', 'v7')
    expect(res.error).toMatch(/video cambió/i)
    expect(getEntregasPreviewUrl).not.toHaveBeenCalled()
  })

  it('signs the pinned file when it still matches the current idea delivery', async () => {
    getEntregaVideoEditado.mockResolvedValue({ id: 'v7' })
    getEntregasPreviewUrl.mockResolvedValue({ url: 'https://signed.example/v7.mp4' })
    const { getReciboIdeaPreviewUrl } = await import('./recibo')
    expect((await getReciboIdeaPreviewUrl('outfit', 'v7')).url).toContain('v7.mp4')
    expect(getEntregasPreviewUrl).toHaveBeenCalledWith('v7')
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

describe('getReciboIdeaDownloadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('downloads the same cut the card is showing', async () => {
    getEntregaVideoEditado.mockResolvedValue({ id: 'v7' })
    getEntregasDownloadUrl.mockResolvedValue({ url: 'https://signed.example/v7.mp4?attachment' })
    const { getReciboIdeaDownloadUrl } = await import('./recibo')
    const res = await getReciboIdeaDownloadUrl('outfit', 'v7')
    expect(getEntregaVideoEditado).toHaveBeenCalledWith('outfit')
    expect(getEntregasDownloadUrl).toHaveBeenCalledWith('v7')
    expect(getEntregasPreviewUrl).not.toHaveBeenCalled()
    expect(res.url).toBe('https://signed.example/v7.mp4?attachment')
  })

  it('refuses a newer cut than the one on the card instead of downloading it', async () => {
    getEntregaVideoEditado.mockResolvedValue({ id: 'v8' })
    const { getReciboIdeaDownloadUrl } = await import('./recibo')
    const res = await getReciboIdeaDownloadUrl('outfit', 'v7')
    expect(res.error).toMatch(/video cambió/i)
    expect(getEntregasDownloadUrl).not.toHaveBeenCalled()
  })

  it('returns Sin video editado when the idea has no usable cut', async () => {
    getEntregaVideoEditado.mockResolvedValue({ id: null })
    const { getReciboIdeaDownloadUrl } = await import('./recibo')
    expect((await getReciboIdeaDownloadUrl('idea-2')).error).toMatch(/Sin video editado/i)
    expect(getEntregasDownloadUrl).not.toHaveBeenCalled()
  })

  it('passes the permission error through without signing', async () => {
    getEntregaVideoEditado.mockResolvedValue({ error: 'No autorizado' })
    const { getReciboIdeaDownloadUrl } = await import('./recibo')
    expect((await getReciboIdeaDownloadUrl('idea-3', 'v1')).error).toBe('No autorizado')
    expect(getEntregasDownloadUrl).not.toHaveBeenCalled()
  })

  it('rejects an empty idea id', async () => {
    const { getReciboIdeaDownloadUrl } = await import('./recibo')
    expect((await getReciboIdeaDownloadUrl('')).error).toBe('Falta el video')
    expect(getEntregaVideoEditado).not.toHaveBeenCalled()
  })
})
