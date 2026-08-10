import { describe, it, expect } from 'vitest'
import {
  PIPELINE_PUBLISHED_GRACE_MS,
  isPipelineVisibleIdea,
  isPublicationStage,
  isRecentlyPublished,
  isWaitingToPublish,
} from './pipeline-publication'

const NOW = Date.parse('2026-06-17T12:00:00Z')
const RECENT = new Date(NOW - 2 * 60 * 60 * 1000).toISOString()
const OLD = new Date(NOW - PIPELINE_PUBLISHED_GRACE_MS - 60_000).toISOString()

describe('pipeline publication visibility', () => {
  it('treats approved-but-not-live videos as waiting to publish', () => {
    expect(isWaitingToPublish({ approval_status: 'approved', status: 'producida' })).toBe(true)
    expect(isPublicationStage({ approval_status: 'approved', status: 'producida' }, NOW)).toBe(true)
  })

  it('keeps recently published videos on the board', () => {
    expect(isRecentlyPublished({ status: 'publicada', published_at: RECENT }, NOW)).toBe(true)
    expect(isPipelineVisibleIdea({ status: 'publicada', published_at: RECENT }, NOW)).toBe(true)
    expect(isPublicationStage({ status: 'publicada', published_at: RECENT }, NOW)).toBe(true)
  })

  it('drops published videos after 24 hours', () => {
    expect(isRecentlyPublished({ status: 'publicada', published_at: OLD }, NOW)).toBe(false)
    expect(isPipelineVisibleIdea({ status: 'publicada', published_at: OLD }, NOW)).toBe(false)
  })

  it('leaves in-flight videos visible', () => {
    expect(isPipelineVisibleIdea({ status: 'grabada', approval_status: 'pending' }, NOW)).toBe(true)
  })
})
