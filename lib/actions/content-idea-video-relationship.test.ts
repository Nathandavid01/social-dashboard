import { describe, expect, it } from 'vitest'
import { findAmbiguousContentIdeaVideoEmbeds } from '../../scripts/check-content-idea-video-relationships.mjs'

describe('content idea/video PostgREST relationships', () => {
  it('always names the foreign key when embedding either table', () => {
    expect(
      findAmbiguousContentIdeaVideoEmbeds(),
      'PostgREST sees two relationships between content_ideas and content_idea_videos. Use an explicit !foreign_key hint.',
    ).toEqual([])
  })
})
