import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findAmbiguousContentIdeaVideoEmbeds } from '../../scripts/check-content-idea-video-relationships.mjs'

const fixtureRoots: string[] = []

function createFixture(source: string) {
  const root = mkdtempSync(join(tmpdir(), 'content-idea-video-relationship-'))
  fixtureRoots.push(root)
  mkdirSync(join(root, 'app'))
  mkdirSync(join(root, 'lib'))
  writeFileSync(join(root, 'app', 'query.ts'), source)
  return root
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true })
})

describe('content idea/video PostgREST relationships', () => {
  it('always names the foreign key when embedding either table', () => {
    expect(
      findAmbiguousContentIdeaVideoEmbeds(),
      'PostgREST sees two relationships between content_ideas and content_idea_videos. Use an explicit !foreign_key hint.',
    ).toEqual([])
  })

  it('detects an ambiguous embed', () => {
    const root = createFixture(
      `supabase.from('content_ideas').select('videos:content_idea_videos(id)')`,
    )

    expect(findAmbiguousContentIdeaVideoEmbeds(root)).toEqual(['app/query.ts:1'])
  })

  it('accepts an explicit foreign-key hint', () => {
    const root = createFixture(
      `supabase.from('content_ideas').select('videos:content_idea_videos!content_idea_videos_idea_id_fkey(id)')`,
    )

    expect(findAmbiguousContentIdeaVideoEmbeds(root)).toEqual([])
  })
})
