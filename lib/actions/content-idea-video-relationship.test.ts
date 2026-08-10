import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findAmbiguousContentIdeaVideoEmbeds,
  findContentIdeaVideoRelationshipFindings,
} from '../../scripts/check-content-idea-video-relationships.mjs'

const fixtureRoots: string[] = []

function createFixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'content-idea-video-relationship-'))
  fixtureRoots.push(root)
  for (const dir of ['app', 'lib', 'components']) {
    mkdirSync(join(root, dir), { recursive: true })
  }
  for (const [rel, source] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, source)
  }
  return root
}

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true })
})

describe('content idea/video PostgREST relationships (static guard)', () => {
  it('passes on the real codebase (no bare/wrong embeds in app|lib|components)', () => {
    const findings = findContentIdeaVideoRelationshipFindings()
    expect(
      findings,
      findings.map((f) => `${f.location}: ${f.message}`).join('\n') ||
        'PostgREST sees two relationships between content_ideas and content_idea_videos. Use !content_idea_videos_idea_id_fkey',
    ).toEqual([])
  })

  it('legacy location list is empty on the real codebase', () => {
    expect(findAmbiguousContentIdeaVideoEmbeds()).toEqual([])
  })

  it('detects a bare videos embed (the /revision killer)', () => {
    const root = createFixture({
      'lib/query.ts': `
        const supabase = {} as any
        await supabase.from('content_ideas').select('videos:content_idea_videos(id)')
      `,
    })

    const findings = findContentIdeaVideoRelationshipFindings(root)
    expect(findings.some((f) => f.type === 'bare_videos_embed')).toBe(true)
    expect(findAmbiguousContentIdeaVideoEmbeds(root).length).toBeGreaterThan(0)
  })

  it('detects bare embed even when select is multiline (getIdeacionPipeline style)', () => {
    const root = createFixture({
      'lib/pipeline.ts': `
        export async function load() {
          return supabase
            .from('content_ideas')
            .select(\`
              *,
              videos:content_idea_videos(
                id, kind
              )
            \`)
        }
      `,
    })

    const locs = findAmbiguousContentIdeaVideoEmbeds(root)
    expect(locs.some((l) => l.startsWith('lib/pipeline.ts:'))).toBe(true)
  })

  it('detects bare embed hidden in components/', () => {
    const root = createFixture({
      'components/board.tsx': `
        // client-side surprise query — must not slip past the guard
        supabase.from('content_ideas').select('id, videos:content_idea_videos(*)')
      `,
    })

    expect(findAmbiguousContentIdeaVideoEmbeds(root).length).toBeGreaterThan(0)
  })

  it('accepts the allowed idea_id fkey hint', () => {
    const root = createFixture({
      'lib/ok.ts': `
        supabase.from('content_ideas').select(
          'videos:content_idea_videos!content_idea_videos_idea_id_fkey(id)'
        )
      `,
    })

    expect(findContentIdeaVideoRelationshipFindings(root)).toEqual([])
  })

  it('accepts the short !idea_id column hint', () => {
    const root = createFixture({
      'lib/ok-short.ts': `
        supabase.from('content_ideas').select('videos:content_idea_videos!idea_id(id)')
      `,
    })

    expect(findContentIdeaVideoRelationshipFindings(root)).toEqual([])
  })

  it('rejects the reverse editing_source FK hint (must never come back)', () => {
    const root = createFixture({
      'lib/bad-reverse.ts': `
        supabase.from('content_ideas').select(
          'source:content_idea_videos!content_ideas_editing_source_video_id_fkey(id)'
        )
      `,
    })

    const findings = findContentIdeaVideoRelationshipFindings(root)
    expect(findings.some((f) => f.type === 'disallowed_videos_hint')).toBe(true)
    expect(findings[0]?.message).toMatch(/editing_source|Disallowed/i)
  })

  it('rejects any unknown hint name on videos embed', () => {
    const root = createFixture({
      'lib/bad-hint.ts': `
        supabase.from('content_ideas').select('videos:content_idea_videos!not_a_real_fkey(id)')
      `,
    })

    expect(
      findContentIdeaVideoRelationshipFindings(root).some((f) => f.type === 'disallowed_videos_hint'),
    ).toBe(true)
  })

  it('detects reverse bare embed from content_idea_videos → content_ideas', () => {
    const root = createFixture({
      'lib/reverse.ts': `
        supabase.from('content_idea_videos').select('id, idea:content_ideas(id, title)')
      `,
    })

    expect(
      findContentIdeaVideoRelationshipFindings(root).some((f) => f.type === 'bare_ideas_embed'),
    ).toBe(true)
  })

  it('does not flag .from("content_idea_videos") table access as an embed', () => {
    const root = createFixture({
      'lib/plain.ts': `
        await supabase.from('content_idea_videos').select('id, kind').eq('idea_id', ideaId)
      `,
    })

    expect(findContentIdeaVideoRelationshipFindings(root)).toEqual([])
  })

  it('does not flag comments that mention content_idea_videos(', () => {
    const root = createFixture({
      'lib/comment.ts': `
        // Example (do not copy): videos:content_idea_videos(id)
        await supabase.from('content_ideas').select('id')
      `,
    })

    expect(findContentIdeaVideoRelationshipFindings(root)).toEqual([])
  })
})
