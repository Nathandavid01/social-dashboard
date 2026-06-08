import { describe, it, expect } from 'vitest'
import { aggregateUploadsByUser, joinUserNames, type UploadRow } from './video-upload-metrics'

const row = (over: Partial<UploadRow> = {}): UploadRow => ({
  uploaded_by: 'u1', kind: 'raw', status: 'uploaded', uploaded_at: '2026-06-01', ...over,
})

describe('aggregateUploadsByUser', () => {
  it('returns [] for empty input', () => {
    expect(aggregateUploadsByUser([])).toEqual([])
  })

  it('counts per user per kind and totals', () => {
    const out = aggregateUploadsByUser([
      row({ kind: 'raw' }), row({ kind: 'raw' }), row({ kind: 'raw' }),
      row({ kind: 'edited' }), row({ kind: 'edited' }),
      row({ kind: 'broll' }),
    ])
    expect(out).toEqual([{ userId: 'u1', raw: 3, broll: 1, edited: 2, total: 6 }])
  })

  it('excludes archived uploads', () => {
    const out = aggregateUploadsByUser([row({ kind: 'edited' }), row({ kind: 'edited', status: 'archived' })])
    expect(out[0].edited).toBe(1)
    expect(out[0].total).toBe(1)
  })

  it('skips rows with no uploader', () => {
    const out = aggregateUploadsByUser([row(), row({ uploaded_by: null })])
    expect(out).toHaveLength(1)
    expect(out[0].userId).toBe('u1')
  })

  it('applies the since filter on uploaded_at', () => {
    const out = aggregateUploadsByUser(
      [row({ uploaded_at: '2026-05-01' }), row({ uploaded_at: '2026-06-05' })],
      { since: '2026-06-01' },
    )
    expect(out[0].total).toBe(1)
  })

  it('separates counts per user', () => {
    const out = aggregateUploadsByUser([row({ uploaded_by: 'a' }), row({ uploaded_by: 'b', kind: 'edited' })])
    const a = out.find((r) => r.userId === 'a')!
    const b = out.find((r) => r.userId === 'b')!
    expect(a.raw).toBe(1)
    expect(b.edited).toBe(1)
  })
})

describe('joinUserNames', () => {
  it('resolves full_name from the profiles lookup', () => {
    const agg = aggregateUploadsByUser([row({ uploaded_by: 'u1' })])
    const out = joinUserNames(agg, [{ id: 'u1', full_name: 'Ana Torres' }])
    expect(out[0].userName).toBe('Ana Torres')
  })
  it('yields null userName when no matching profile', () => {
    const agg = aggregateUploadsByUser([row({ uploaded_by: 'ghost' })])
    const out = joinUserNames(agg, [{ id: 'u1', full_name: 'Ana' }])
    expect(out[0].userName).toBeNull()
  })
})
