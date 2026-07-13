/**
 * Pure, network-free helpers for the client review link (portal de aprobación).
 *
 * The client opens a public `/review/<token>` link (no login), sees the edited
 * video + caption, and can Aprobar / Rechazar / Comentar. These helpers own the
 * token URL, the 30-day expiry math, decision validation, and Spanish labels —
 * all unit-tested with no DB/network so the security-sensitive surface is thin.
 *
 * Timestamps here are absolute (timestamptz / ISO with offset), so `getTime()`
 * comparison is correct and timezone-independent — unlike date-only deadlines,
 * which must use string compares (see lib/utils/deadlines.ts).
 */

export type ClientReviewStatus = 'pending' | 'approved' | 'rejected'
export type ReviewAuthorKind = 'client' | 'staff'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Public review URL for a token, e.g. `${base}/review/<token>`. */
export function reviewLinkUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/review/${token}`
}

/** ISO timestamp `days` (default 30) after `nowISO`, for the token's expiry. */
export function defaultExpiryISO(nowISO: string, days = 30): string {
  const expiry = new Date(new Date(nowISO).getTime() + days * MS_PER_DAY)
  return expiry.toISOString()
}

/**
 * True when the link is at or past its expiry. A null expiry never expires
 * (defensive — a token row should always carry an expiry, but don't crash if not).
 */
export function isReviewExpired(expiresAtISO: string | null, nowISO: string): boolean {
  if (!expiresAtISO) return false
  return new Date(nowISO).getTime() >= new Date(expiresAtISO).getTime()
}

/** The client may still approve/reject/comment only while the link is live. */
export function canClientDecide(input: { expiresAtISO: string | null; nowISO: string }): boolean {
  return !isReviewExpired(input.expiresAtISO, input.nowISO)
}

/**
 * Can the client still CHANGE a vote they already cast?
 *
 * No, once they approved. Approving schedules the video in Metricool, and we do
 * not pull a scheduled post back down — so offering "cambiar decisión" after an
 * approval would promise something we can't honor. They comment instead, and the
 * staff acts.
 *
 * A rejection stays changeable: the video never left the agency, so a client who
 * changes their mind to "approved" still gets it published.
 *
 * The RPC (migration 0044) enforces this too — this helper only decides what the
 * portal SHOWS. Keep both in step.
 */
export function canClientChangeVote(current: ClientReviewStatus): boolean {
  return current !== 'approved'
}

/**
 * Validate a client decision. Only 'approved' | 'rejected' are settable by the
 * client — 'pending' is the initial state and cannot be chosen. Returns null for
 * anything invalid so callers reject the write.
 */
export function normalizeDecision(input: string): Exclude<ClientReviewStatus, 'pending'> | null {
  const v = input.trim().toLowerCase()
  return v === 'approved' || v === 'rejected' ? v : null
}

const STATUS_LABELS: Record<ClientReviewStatus, string> = {
  pending: 'Pendiente de revisión',
  approved: 'Aprobado por el cliente',
  rejected: 'Rechazado por el cliente',
}

export function clientReviewStatusLabel(status: ClientReviewStatus): string {
  return STATUS_LABELS[status] ?? STATUS_LABELS.pending
}

/** Spanish one-liner about when the link expires (or that it already did). */
export function expiryNoticeES(expiresAtISO: string | null, nowISO: string): string {
  if (!expiresAtISO) return 'Este link de revisión no expira.'
  const diffMs = new Date(expiresAtISO).getTime() - new Date(nowISO).getTime()
  if (diffMs <= 0) return 'Este link de revisión venció.'
  const days = Math.floor(diffMs / MS_PER_DAY)
  if (days === 0) return 'Este link de revisión vence hoy.'
  if (days === 1) return 'Este link de revisión vence en 1 día.'
  return `Este link de revisión vence en ${days} días.`
}

export function authorKindLabel(kind: ReviewAuthorKind): string {
  return kind === 'client' ? 'Cliente' : 'Equipo'
}

/**
 * The client-facing headline + subtext for the current review decision, so the
 * public page can confirm the client's action clearly (not just a fleeting
 * toast). Names the reviewer when known.
 */
export function reviewDecisionSummary(
  status: ClientReviewStatus,
  reviewerName?: string | null,
): { headline: string; sub: string; tone: 'neutral' | 'success' | 'warning' } {
  const who = reviewerName?.trim()
  switch (status) {
    case 'approved':
      return {
        headline: who ? `✓ Aprobado por ${who}` : '✓ Aprobaste este video',
        sub: '¡Gracias! El equipo lo publicará según lo pautado.',
        tone: 'success',
      }
    case 'rejected':
      return {
        headline: who ? `${who} pidió cambios` : 'Pediste cambios',
        sub: 'El equipo revisará tus comentarios y subirá una nueva versión.',
        tone: 'warning',
      }
    default:
      return {
        headline: 'Tu opinión sobre este video',
        sub: 'Aprueba el video o pide cambios. Puedes dejar un comentario.',
        tone: 'neutral',
      }
  }
}

const REVIEW_TZ = 'America/Puerto_Rico'

/**
 * Absolute instant → `DD/MM/YYYY HH:MM` in Puerto Rico time. Uses numeric parts
 * only (via en-CA) so the output is stable across ICU versions — no month-name
 * variance. Empty string for null/invalid input.
 */
export function formatReviewDateES(iso: string | null, tz: string = REVIEW_TZ): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour') // Intl quirk: midnight as 24
  return `${get('day')}/${get('month')}/${get('year')} ${hour}:${get('minute')}`
}

/** A single comment in the review thread (shape of the RPC's jsonb). */
export type ReviewComment = {
  id: string
  author_kind: ReviewAuthorKind
  author_name: string
  body: string
  created_at: string
}

/** The full review payload returned by `get_review_by_token` (migration 0042). */
export type ReviewData = {
  idea_id: string
  title: string | null
  content_type: string | null
  caption: string | null
  publish_date: string | null
  client_name: string
  client_review_status: ClientReviewStatus
  client_reviewer_name: string | null
  client_reviewed_at: string | null
  expires_at: string | null
  edited_video_key: string | null
  comments: ReviewComment[]
}
