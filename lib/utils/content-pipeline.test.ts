import { describe, it, expect } from 'vitest'
import { bucketize, type IdeaRow } from './content-pipeline'

/**
 * Regression: "publicadas esta semana/mes" must key off published_at (set by the
 * set_idea_published_at DB trigger when a card enters 'publicada'), NOT updated_at.
 * updated_at bumps on every edit (caption, dates, drag), so using it inflated the
 * weekly quota count whenever an old published idea was touched this week.
 */
describe('bucketize — publicadas counts by published_at', () => {
  const weekStart = '2026-06-01T00:00:00.000Z'
  const monthStart = '2026-06-01T00:00:00.000Z'

  it('does NOT count a publicada whose published_at is old, even if updated_at is recent', () => {
    const rows: IdeaRow[] = [
      {
        client_id: 'c1',
        status: 'publicada',
        published_at: '2026-04-10T12:00:00.000Z', // April — before this week/month
        updated_at: '2026-06-02T12:00:00.000Z', // touched today
        created_at: '2026-04-01T12:00:00.000Z',
      },
    ]
    const b = bucketize(rows, weekStart, monthStart)
    expect(b.publicadasSemana).toBe(0)
    expect(b.publicadasMes).toBe(0)
  })

  it('counts a publicada whose published_at falls within the week/month', () => {
    const rows: IdeaRow[] = [
      {
        client_id: 'c1',
        status: 'publicada',
        published_at: '2026-06-02T09:00:00.000Z',
        updated_at: '2026-06-02T09:00:00.000Z',
        created_at: '2026-05-20T09:00:00.000Z',
      },
    ]
    const b = bucketize(rows, weekStart, monthStart)
    expect(b.publicadasSemana).toBe(1)
    expect(b.publicadasMes).toBe(1)
  })

  it('falls back to updated_at when published_at is null (legacy rows)', () => {
    const rows: IdeaRow[] = [
      {
        client_id: 'c1',
        status: 'publicada',
        published_at: null,
        updated_at: '2026-06-02T09:00:00.000Z',
        created_at: '2026-05-20T09:00:00.000Z',
      },
    ]
    const b = bucketize(rows, weekStart, monthStart)
    expect(b.publicadasSemana).toBe(1)
  })

  it('buckets non-published statuses into their stage counters', () => {
    const rows: IdeaRow[] = [
      { client_id: 'c1', status: 'idea', published_at: null, updated_at: null, created_at: 'x' },
      { client_id: 'c1', status: 'asignada', published_at: null, updated_at: null, created_at: 'x' },
      { client_id: 'c1', status: 'grabada', published_at: null, updated_at: null, created_at: 'x' },
      { client_id: 'c1', status: 'producida', published_at: null, updated_at: null, created_at: 'x' },
    ]
    const b = bucketize(rows, weekStart, monthStart)
    expect(b).toMatchObject({ ideas: 1, porGrabar: 1, porEditar: 1, porPublicar: 1 })
  })
})
