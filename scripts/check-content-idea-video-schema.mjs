/**
 * Live schema guard: ensure PostgREST still sees a SINGLE relationship
 * between content_ideas and content_idea_videos.
 *
 * If someone re-adds content_ideas.editing_source_video_id_fkey (or any second
 * FK), bare embeds fail with PGRST201 and /revision dies again.
 *
 * Requires env (same as the app):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * Exit codes:
 *   0 — schema OK (single relationship) or skipped (no env)
 *   1 — dual relationship detected (PGRST201)
 *   2 — request failed for another reason
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/**
 * Probe PostgREST for dual FKs by attempting a bare embed.
 * @returns {Promise<{ ok: true, skipped?: boolean, status?: number } | { ok: false, kind: string, detail: string }>}
 */
export async function probeIdeaVideoRelationshipSchema(fetchImpl = globalThis.fetch) {
  loadEnvLocal()
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!url || !key) {
    return { ok: true, skipped: true }
  }

  // Bare embed — succeeds only when exactly one relationship exists.
  const select = encodeURIComponent('id,videos:content_idea_videos(id)')
  const endpoint = `${url}/rest/v1/content_ideas?select=${select}&limit=1`
  const res = await fetchImpl(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  })

  if (res.ok) {
    return { ok: true, status: res.status }
  }

  const body = await res.text()
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    parsed = null
  }

  if (res.status === 300 || parsed?.code === 'PGRST201') {
    return {
      ok: false,
      kind: 'dual_relationship',
      detail:
        parsed?.message ||
        body.slice(0, 400) ||
        'PGRST201: more than one relationship between content_ideas and content_idea_videos',
    }
  }

  return {
    ok: false,
    kind: 'request_error',
    detail: `HTTP ${res.status}: ${body.slice(0, 300)}`,
  }
}

/**
 * The exact select shape used by /revision via getIdeacionPipeline.
 * Must keep working in production.
 */
export const REVISION_PIPELINE_SELECT = `
  id,
  client_id,
  title,
  status,
  approval_status,
  videos:content_idea_videos!content_idea_videos_idea_id_fkey(id, kind, storage_provider, status)
`.replace(/\s+/g, '')

export async function probeRevisionPipelineSelect(fetchImpl = globalThis.fetch) {
  loadEnvLocal()
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !key) return { ok: true, skipped: true }

  const select = encodeURIComponent(
    'id,client_id,title,status,approval_status,videos:content_idea_videos!content_idea_videos_idea_id_fkey(id,kind,storage_provider,status)',
  )
  const endpoint = `${url}/rest/v1/content_ideas?select=${select}&limit=3`
  const res = await fetchImpl(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  })
  if (res.ok) return { ok: true, status: res.status }
  const body = await res.text()
  return { ok: false, kind: 'revision_select_failed', detail: `HTTP ${res.status}: ${body.slice(0, 400)}` }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  const requireLive = process.argv.includes('--require')
  const schema = await probeIdeaVideoRelationshipSchema()
  if (schema.skipped) {
    if (requireLive) {
      console.error('Live schema check required but NEXT_PUBLIC_SUPABASE_URL / keys are missing.')
      process.exitCode = 2
    } else {
      console.log('Live schema check skipped (no Supabase env).')
    }
  } else if (!schema.ok) {
    console.error('LIVE SCHEMA CHECK FAILED:', schema.kind)
    console.error(schema.detail)
    if (schema.kind === 'dual_relationship') {
      console.error('')
      console.error('A second FK between content_ideas and content_idea_videos is back.')
      console.error('Drop reverse FKs (e.g. content_ideas_editing_source_video_id_fkey).')
      console.error('See supabase/migrations/0058_drop_editing_source_video_fk.sql')
    }
    process.exitCode = 1
  } else {
    console.log('Live schema OK: single relationship content_ideas ↔ content_idea_videos.')
  }

  if (process.exitCode) {
    // still try revision probe for more signal
  } else {
    const rev = await probeRevisionPipelineSelect()
    if (rev.skipped) {
      // already logged skip
    } else if (!rev.ok) {
      console.error('REVISION SELECT CHECK FAILED:', rev.detail)
      process.exitCode = 1
    } else {
      console.log('Revision pipeline select OK.')
    }
  }
}
