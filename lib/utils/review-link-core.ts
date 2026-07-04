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
