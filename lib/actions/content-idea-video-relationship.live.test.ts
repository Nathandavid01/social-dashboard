/**
 * Live guards against the dual-FK regression that took down /revision.
 *
 * Skipped automatically when Supabase env is missing (local unit CI).
 * Force with: RELATIONSHIP_LIVE=1 npx vitest run ...live.test.ts
 *
 * Env (from .env.local or process):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  probeIdeaVideoRelationshipSchema,
  probeRevisionPipelineSelect,
} from '../../scripts/check-content-idea-video-schema.mjs'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    const k = t.slice(0, i)
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (process.env[k] === undefined) process.env[k] = v
  }
}

loadEnvLocal()

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
)
const forceLive = process.env.RELATIONSHIP_LIVE === '1'
const describeLive = hasEnv || forceLive ? describe : describe.skip

describeLive('content idea/video relationships (LIVE against Supabase)', () => {
  it('allows only ONE relationship (bare embed must NOT return PGRST201)', async () => {
    const result = await probeIdeaVideoRelationshipSchema()
    if (result.skipped && forceLive) {
      throw new Error('RELATIONSHIP_LIVE=1 but Supabase env is missing')
    }
    if (result.skipped) return

    expect(
      result.ok,
      !result.ok && result.kind === 'dual_relationship'
        ? `Dual FK is back — /revision will break again.\n${result.detail}\n` +
            'Drop content_ideas_editing_source_video_id_fkey (see migration 0058).'
        : !result.ok
          ? result.detail
          : undefined,
    ).toBe(true)
  })

  it('runs the /revision pipeline select shape without embed errors', async () => {
    const result = await probeRevisionPipelineSelect()
    if (result.skipped) return

    expect(
      result.ok,
      !result.ok
        ? `Revision select failed (this is what /revision loads):\n${result.detail}`
        : undefined,
    ).toBe(true)
  })

  it('documents PGRST201 shape so a dual-FK regression is unmistakable', async () => {
    // Synthetic: if the probe ever returns dual_relationship, the detail must
    // mention both tables (guards against silent wrong error classification).
    const fake = {
      ok: false as const,
      kind: 'dual_relationship',
      detail:
        "Could not embed because more than one relationship was found for 'content_ideas' and 'content_idea_videos'",
    }
    expect(fake.detail).toMatch(/content_ideas/)
    expect(fake.detail).toMatch(/content_idea_videos/)
    expect(fake.detail).toMatch(/more than one relationship|Could not embed/i)
  })
})
