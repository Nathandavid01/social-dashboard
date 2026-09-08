import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ row: {} as Record<string, unknown>, denied: false }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: async () => { if (h.denied) throw Error('denied') }, currentUserHas: async () => false }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => {
  let matches = true
  let patch: Record<string, unknown> = {}
  const q: any = {
    update: (value: Record<string, unknown>) => { patch = value; return q },
    eq: (key: string, value: unknown) => { matches &&= h.row[key] === value; return q },
    is: (key: string, value: unknown) => { matches &&= h.row[key] === value; return q },
    not: (key: string, _operator: string, value: string) => { matches &&= !value.slice(1,-1).split(',').includes(String(h.row[key])); return q },
    select: () => q,
    maybeSingle: async () => { if (matches) Object.assign(h.row, patch); return { data: matches ? { id: h.row.id } : null, error: null } },
  }
  return q
} }) }))
import { reopenReviewForVerification } from './pipeline-submit'
beforeEach(() => { h.denied = false; h.row = { id: 'i', status: 'producida', approval_status: 'approved', approved_video_id: 'file', metricool_post_id: null, posted_at: null, published_at: null, posting_started_at: null } })
it('reopens an unsent approval for verification', async () => {
  expect(await reopenReviewForVerification('i')).toEqual({ ok: true })
  expect(h.row).toMatchObject({ approval_status: 'submitted', approved_video_id: null })
})
it.each(['2026-09-08T12:00:00Z', '2026-09-01T12:00:00Z'])('preserves the reviewed file while a posting claim exists: %s', async started => {
  h.row.posting_started_at = started
  expect(await reopenReviewForVerification('i')).toHaveProperty('error')
  expect(h.row).toMatchObject({ approval_status: 'approved', approved_video_id: 'file' })
})
it.each(['publicada', 'descartada'])('does not reopen closed work: %s', async status => {
  h.row.status = status
  expect(await reopenReviewForVerification('i')).toHaveProperty('error')
  expect(h.row.approval_status).toBe('approved')
})
it('requires review permission', async () => {
  h.denied = true
  expect(await reopenReviewForVerification('i')).toHaveProperty('error')
  expect(h.row.approval_status).toBe('approved')
})
