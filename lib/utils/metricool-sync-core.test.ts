import { describe, it, expect } from 'vitest'
import { isScheduledPostPublished, ideasToMarkPublished, type SyncIdeaRef } from './metricool-sync-core'

const prov = (status: string) => ({ network: 'instagram', id: '1', status })

describe('isScheduledPostPublished', () => {
  it('is published when not a draft and every provider is PUBLISHED', () => {
    expect(isScheduledPostPublished({ draft: false, providers: [prov('PUBLISHED'), prov('PUBLISHED')] })).toBe(true)
  })
  it('is not published while any provider is pending or errored', () => {
    expect(isScheduledPostPublished({ draft: false, providers: [prov('PUBLISHED'), prov('PENDING')] })).toBe(false)
    expect(isScheduledPostPublished({ draft: false, providers: [prov('ERROR')] })).toBe(false)
  })
  it('a draft is never published', () => {
    expect(isScheduledPostPublished({ draft: true, providers: [prov('PUBLISHED')] })).toBe(false)
  })
  it('a post with no providers is not published', () => {
    expect(isScheduledPostPublished({ draft: false, providers: [] })).toBe(false)
  })
})

describe('ideasToMarkPublished', () => {
  const ideas: SyncIdeaRef[] = [
    { id: 'a', metricool_post_id: 101, status: 'producida' }, // → publish
    { id: 'b', metricool_post_id: 102, status: 'publicada' },  // already published
    { id: 'c', metricool_post_id: 103, status: 'descartada' }, // discarded
    { id: 'd', metricool_post_id: null, status: 'grabada' },   // never sent
    { id: 'e', metricool_post_id: 999, status: 'grabada' },    // not in published set
  ]

  it('marks only the ideas whose Metricool post is published and not already done/discarded', () => {
    expect(ideasToMarkPublished(ideas, [101, 102, 103])).toEqual(['a'])
  })
  it('returns nothing when no posts are published', () => {
    expect(ideasToMarkPublished(ideas, [])).toEqual([])
  })
})
