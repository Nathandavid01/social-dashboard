/**
 * Pure helpers for sending an approved Idea Lab idea to Metricool as a
 * scheduled DRAFT. Kept out of the `'use server'` action so the scheduling /
 * readiness logic is unit-testable without mocking Supabase/Metricool.
 */

export interface SendableApprovedIdea {
  generated_caption: string | null
  /** Set once we've sent the draft — the idempotency guard. */
  metricool_post_id: number | null
}

export interface SendReadiness {
  ready: boolean
  reason?: string
}

/**
 * An approved idea is sendable once it has a caption, has not already been sent
 * (idempotency), AND its client has a Metricool blog id. The blog-id gate is a
 * SAFETY check: without it the draft would land in the global default (agency)
 * Metricool account instead of the client's — so we refuse rather than guess.
 */
export function approvedIdeaSendReadiness(
  idea: SendableApprovedIdea,
  metricoolBlogId: string | null | undefined,
): SendReadiness {
  if (idea.metricool_post_id != null) return { ready: false, reason: 'Ya se envió a Metricool' }
  if (!idea.generated_caption || idea.generated_caption.trim().length === 0) {
    return { ready: false, reason: 'Falta el caption' }
  }
  if (!metricoolBlogId || metricoolBlogId.trim().length === 0) {
    return { ready: false, reason: 'El cliente no tiene Metricool configurado (falta blog_id)' }
  }
  return { ready: true }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^(\d{1,2}):(\d{2})$/

function normalizeTime(t?: string | null): string | null {
  if (!t) return null
  const m = TIME_RE.exec(t.trim())
  if (!m) return null
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0')
  return `${hh}:${m[2]}`
}

/**
 * Build the naive "YYYY-MM-DDTHH:MM:SS" datetime to schedule the draft at, from
 * a user-picked date (required) and time (defaults to 10:00). Metricool
 * interprets this in the post's timezone (America/Puerto_Rico). Returns null if
 * the date is missing/malformed — the caller surfaces that as a validation error.
 */
export function buildScheduledDateTime(
  date: string | null | undefined,
  time?: string | null,
): string | null {
  if (!date || !DATE_RE.test(date.trim())) return null
  const t = normalizeTime(time) ?? '10:00'
  return `${date.trim()}T${t}:00`
}
