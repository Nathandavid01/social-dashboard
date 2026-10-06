import { describe, expect, it } from 'vitest'
import { ERIC_IDS, RECIBO_HELD_CLIENT_IDS, reciboBoardIdeas } from './board-ideas'
import { reciboMonthlyUploadCounts, reciboOccupancyIdeas, type ReciboSpaceIdea } from './cadence-spaces'
import { reciboUploadCounts } from './upload-counts'

const NATHAN = '165e5259-8f69-4ff4-b0f0-f790cba77b80'
const NATHAN_TEST = '964999bf-29a3-4599-8776-7251f499b814'
function idea(id: string, uploadedBy = NATHAN) {
  return {
    id, client_id: 'human', client: { status: 'active' }, status: 'producida',
    client_review_status: 'pending',
    videos: [{
      id: id + '-v1', kind: 'edited', status: 'uploaded', storage_provider: 'entregas-r2',
      drive_file_id: id + '.mp4', uploaded_by: uploadedBy, uploaded_at: '2026-10-06T14:00:00Z',
      uploader: { full_name: uploadedBy === NATHAN ? 'Nathan Torres' : 'Eric Perez' },
    }],
  }
}
function expectExcluded(row: ReciboSpaceIdea) {
  expect(reciboBoardIdeas([row], [])).toEqual([])
  const occupancy = reciboOccupancyIdeas([row], [])
  expect(occupancy).toEqual([])
  expect(reciboMonthlyUploadCounts(occupancy, '2026-10-06').total).toBe(0)
}

describe('Eric and Nathan edited deliveries across Recibo and its counters', () => {
  it.each([NATHAN, ...ERIC_IDS])('includes the verified uploader %s in both scopes', (uploader) => {
    const row = idea('cut', uploader)
    expect(reciboBoardIdeas([row], [])).toEqual([row])
    expect(reciboOccupancyIdeas([row], [])).toEqual([row])
  })

  it.each([NATHAN_TEST, 'another-owner', '', null])('does not grant eligibility by name or role: %s', (uploader) => {
    const row = idea('other')
    expectExcluded({ ...row, videos: [{ ...row.videos[0], uploaded_by: uploader }] })
  })

  it.each([...RECIBO_HELD_CLIENT_IDS])('keeps the business hold for %s', (client_id) => {
    const row = { ...idea('held'), client_id }
    expectExcluded(row)
    expect(reciboBoardIdeas([row], [client_id])).toEqual([])
    expect(reciboOccupancyIdeas([row], [client_id])).toEqual([])
  })

  it.each(['paused', 'archived'])('keeps the client restriction %s', (status) => {
    expectExcluded({ ...idea('client'), client: { status } })
  })

  it.each(['raw', 'broll'])('does not admit Nathan human-client %s without an edited cut', (kind) => {
    const row = idea('raw')
    expectExcluded({ ...row, videos: [{ ...row.videos[0], kind }] })
    const ai = { ...row, client_id: 'ai', videos: [{ ...row.videos[0], kind }] }
    expect(reciboOccupancyIdeas([ai], ['ai'])).toEqual([ai])
    expect(reciboBoardIdeas([ai], ['ai'])).toEqual([])
  })

  it.each(['archived', 'failed'])('keeps unusable cut status %s out of every count', (status) => {
    const row = idea('unusable')
    expectExcluded({ ...row, videos: [{ ...row.videos[0], status }] })
  })

  it('keeps discarded ideas out and preserves published/scheduled monthly history', () => {
    expectExcluded({ ...idea('discarded'), status: 'descartada' })
    const rows = [
      { ...idea('published'), status: 'publicada', published_at: '2026-10-06T15:00:00Z' },
      { ...idea('scheduled'), metricool_post_id: 9, posted_at: '2026-10-06T15:00:00Z' },
    ]
    expect(reciboBoardIdeas(rows, [])).toEqual([])
    expect(reciboOccupancyIdeas(rows, [])).toEqual(rows)
    expect(reciboMonthlyUploadCounts(reciboOccupancyIdeas(rows, []), '2026-10-06').total).toBe(2)
  })

  it('includes eight deliveries in queue, Nathan counter and October, once per idea despite versions', () => {
    const rows = Array.from({ length: 8 }, (_, i) => idea('delivery-' + i))
    rows[0].videos.push({ ...rows[0].videos[0], id: 'older-version', uploaded_at: '2026-10-06T12:00:00Z' })
    const original = JSON.stringify(rows)
    const occupancy = reciboOccupancyIdeas(rows, [])
    const board = reciboBoardIdeas(occupancy, [])
    expect(board).toHaveLength(8)
    expect(reciboUploadCounts(board)).toEqual({ total: 8, nathan: 8, eric: 0, otro: 0 })
    const monthly = reciboMonthlyUploadCounts(occupancy, '2026-10-06')
    expect(monthly.total).toBe(8)
    expect(monthly.months[0]).toMatchObject({ key: '2026-10', count: 8 })
    expect(JSON.stringify(rows)).toBe(original)
  })

  it('preserves AI deliveries by other uploaders', () => {
    const row = { ...idea('ai-other', 'someone-else'), client_id: 'ai' }
    expect(reciboBoardIdeas([row], ['ai'])).toEqual([row])
    expect(reciboOccupancyIdeas([row], ['ai'])).toEqual([row])
  })
})
