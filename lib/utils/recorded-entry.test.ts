import { describe, it, expect } from 'vitest'
import { recordedEntryFields, RECORDED_ENTRY_STAGES, classifyEntry } from './recorded-entry'
import { ideaStage } from './content-batches'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * The intake for already-recorded videos lets the user pick which column the
 * video enters (Video / Edited / Approval). recordedEntryFields turns that
 * choice into the content_ideas status fields, and the result MUST round-trip
 * back to the same column through ideaStage (the board's source of truth).
 */
describe('recordedEntryFields', () => {
  it('video → status grabada', () => {
    expect(recordedEntryFields('video')).toEqual({ status: 'grabada' })
  })

  it('edited → status producida (no approval)', () => {
    expect(recordedEntryFields('edited')).toEqual({ status: 'producida' })
  })

  it('approval → status producida + approval_status submitted', () => {
    expect(recordedEntryFields('approval')).toEqual({
      status: 'producida',
      approval_status: 'submitted',
    })
  })

  it('exposes exactly the three post-recording entry stages', () => {
    expect(RECORDED_ENTRY_STAGES).toEqual(['video', 'edited', 'approval'])
  })

  it.each(RECORDED_ENTRY_STAGES)('round-trips %s back to the same column via ideaStage', (stage) => {
    const fields = recordedEntryFields(stage)
    const idea = { published_at: null, ...fields } as unknown as IdeaWithPipeline
    expect(ideaStage(idea)).toBe(stage)
  })
})

describe('classifyEntry — pipeline indicator split', () => {
  it('video skips idea/title/caption and leaves edited→publication upcoming', () => {
    expect(classifyEntry('video')).toEqual({
      skipped: ['idea', 'title', 'caption'],
      entry: 'video',
      upcoming: ['edited', 'approval', 'publication'],
    })
  })

  it('edited skips through video; only approval/publication remain', () => {
    expect(classifyEntry('edited')).toEqual({
      skipped: ['idea', 'title', 'caption', 'video'],
      entry: 'edited',
      upcoming: ['approval', 'publication'],
    })
  })

  it('approval leaves only publication upcoming', () => {
    expect(classifyEntry('approval')).toEqual({
      skipped: ['idea', 'title', 'caption', 'video', 'edited'],
      entry: 'approval',
      upcoming: ['publication'],
    })
  })

  it('every stage is accounted for exactly once', () => {
    const { skipped, entry, upcoming } = classifyEntry('video')
    expect([...skipped, entry, ...upcoming]).toHaveLength(7)
  })
})
