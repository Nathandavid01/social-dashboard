import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateEq = vi.fn()
const update = vi.fn(() => ({ eq: updateEq }))
const from = vi.fn(() => ({ update }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from })),
}))
vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => undefined),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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
