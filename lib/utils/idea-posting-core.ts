/**
 * Pure helpers for auto-posting an idea to Metricool. Kept out of the
 * `'use server'` action so the readiness/scheduling logic is unit-testable
 * without mocking Supabase/Metricool.
 */

export interface PostableIdea {
  approval_status: string | null
  generated_caption: string | null
  status: string | null
  published_at: string | null
  /** Set once we've posted — the idempotency guard. */
  metricool_post_id: number | null
}

export interface PostReadiness {
  ready: boolean
  reason?: string
}

/**
 * An idea is postable once it is approved, has a caption and an edited video,
 * has not been posted before (idempotency), and isn't already published.
 * Order matters: the idempotency guard is checked first so we never re-post.
 */
export function ideaPostReadiness(idea: PostableIdea, hasEditedVideo: boolean): PostReadiness {
  if (idea.metricool_post_id != null) return { ready: false, reason: 'Ya se publicó en Metricool' }
  if (idea.published_at || idea.status === 'publicada') return { ready: false, reason: 'El video ya está publicado' }
  if (idea.approval_status !== 'approved') return { ready: false, reason: 'El video no está aprobado' }
  if (!idea.generated_caption || idea.generated_caption.trim().length === 0) return { ready: false, reason: 'Falta el caption' }
  if (!hasEditedVideo) return { ready: false, reason: 'Falta el video editado' }
  return { ready: true }
}

function normalizeTime(t?: string | null): string | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  if (!m) return null
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0')
  return `${hh}:${m[2]}`
}

/**
 * The datetime to schedule the post at. Publishes on the idea's PLANNED
 * `publish_date` at the client's `posting_time` (defaults to 10:00). If no
 * planned date exists, falls back to +24h from `nowMs`.
 * Returns a naive "YYYY-MM-DDTHH:MM:SS" string (interpreted by Metricool in the
 * post's timezone — America/Puerto_Rico).
 */
export function buildPublishDateTime(
  publishDate: string | null | undefined,
  postingTime: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (publishDate) {
    const time = normalizeTime(postingTime) ?? '10:00'
    return `${publishDate}T${time}:00`
  }
  return new Date(nowMs + 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
}

/** Networks to post to: the client's own platforms, else its defaults, else IG/FB/TikTok. */
export function resolvePlatforms(
  clientPlatforms?: string[] | null,
  defaultPlatforms?: string[] | null,
): string[] {
  const src =
    clientPlatforms && clientPlatforms.length > 0
      ? clientPlatforms
      : defaultPlatforms && defaultPlatforms.length > 0
        ? defaultPlatforms
        : ['instagram', 'facebook', 'tiktok']
  return src.map((p) => p.toLowerCase())
}
