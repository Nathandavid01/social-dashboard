import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CLIENT_SURFACES = [
  'lib/actions/review-public.ts',
  'lib/actions/review-client-actions.ts',
  'components/review/review-page.tsx',
  'components/review/review-link-panel.tsx',
  'supabase/migrations/0042_client_review_link.sql',
  'supabase/migrations/0044_lock_approved_client_vote.sql',
  'supabase/migrations/0086_recibo_manual_flags.sql',
]

describe('recibo_internal_notes isolation', () => {
  it('el portal del cliente y /review no leen recibo_internal_notes', () => {
    for (const file of CLIENT_SURFACES) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).not.toMatch(/recibo_internal_notes/)
    }
  })

  it('las actions de Recibo no tocan el hilo que ve el cliente', () => {
    const src = readFileSync('lib/actions/recibo-internal-notes.ts', 'utf8')
    expect(src).not.toMatch(/from\('video_review_comments'\)/)
    expect(src).not.toMatch(/addStaffReviewComment/)
    expect(src).not.toMatch(/get_review_by_token/)
    expect(src).toMatch(/from\('recibo_internal_notes'\)/)
  })

  it('addStaffReviewComment no escribe el motivo de Recibo', () => {
    const src = readFileSync('lib/actions/review-staff.ts', 'utf8')
    expect(src).not.toMatch(/getReciboReviewComments/)
    expect(src).not.toMatch(/recibo_internal_notes/)
    expect(src).not.toMatch("revalidatePath('/recibo')")
  })
})
