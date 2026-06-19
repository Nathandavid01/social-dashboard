/**
 * Pure helpers for sending an approved Idea Lab idea to Metricool as a
 * scheduled DRAFT. Kept out of the `'use server'` action so the scheduling /
 * readiness logic is unit-testable without mocking Supabase/Metricool.
 */

<<<<<<< Updated upstream
import { addDaysISO, todayISOInTimeZone } from './deadlines'

/** Timezone Metricool publishes in — the calendar day we anchor scheduling to. */
export const POST_TZ = 'America/Puerto_Rico'

/** Today in the posting timezone (the earliest schedulable day). */
export function scheduleMinDate(now: Date = new Date()): string {
  return todayISOInTimeZone(POST_TZ, now)
}

/** Default value for the schedule date picker — tomorrow in the posting timezone. */
export function defaultScheduleDate(now: Date = new Date()): string {
  return addDaysISO(scheduleMinDate(now), 1)
}

/** Current minute as "YYYY-MM-DDTHH:MM" in the posting timezone (same-day time checks). */
export function nowMinuteInPostTZ(now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: POST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)
  return `${todayISOInTimeZone(POST_TZ, now)}T${time}`
}

/**
 * For an AUTO-PUBLISH post the full datetime must not be in the past — Metricool
 * would publish immediately or reject it. Drafts are exempt (a past-dated draft
 * is harmless and gets finalized by hand). Minute-precision "YYYY-MM-DDTHH:MM"
 * lexicographic compare (fixed width ⇒ chronological). `scheduledFor` is the
 * "YYYY-MM-DDTHH:MM:SS" string from buildScheduledDateTime.
 */
export function autopublishTimeError(
  scheduledFor: string,
  autoPublish: boolean,
  nowMinute: string = nowMinuteInPostTZ(),
): string | null {
  if (!autoPublish) return null
  if (scheduledFor.slice(0, 16) < nowMinute) {
    return 'La hora ya pasó; elige una fecha y hora futuras para autopublicar.'
  }
  return null
}

=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
export interface MetricoolMediaOptions {
  /** Public media URLs to attach (the uploaded video). Omitted when none. */
  mediaUrls?: string[]
  /** With a video attached we auto-publish a REAL scheduled post; a caption-only
   *  quick post stays a draft for the team to finalize in Metricool. */
  autoPublish: boolean
}

/**
 * Build the Metricool media options for a quick-caption post. Attaches the video
 * (when a media URL is given) and applies the user's explicit choice between a
 * scheduled DRAFT (autoPublish=false) and AUTO-PUBLISH. Media and publish mode
 * are independent — a draft can carry a video, and a caption can auto-publish.
 */
export function quickSendMediaOptions(mediaUrl?: string | null, autoPublish = false): MetricoolMediaOptions {
  const v = mediaUrl?.trim()
  return { ...(v ? { mediaUrls: [v] } : {}), autoPublish: !!autoPublish }
}

=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream

/**
 * Validate a user-picked schedule date. Returns a Spanish error string, or null
 * when the date is OK. Rejects missing/malformed dates AND any date before today
 * — you can schedule for today or later, never the past (a past date would land
 * the post in the past on the calendar, or for an auto-publish post trigger an
 * immediate publish / Metricool error). Date-only "YYYY-MM-DD" string compare,
 * never `toISOString()` (which shifts the day at night for users west of UTC).
 */
export function scheduleDateError(
  date: string | null | undefined,
  today: string = scheduleMinDate(),
): string | null {
  if (!date || !DATE_RE.test(date.trim())) return 'Elige una fecha válida para programar.'
  if (date.trim() < today) return 'La fecha ya pasó; elige hoy o una fecha futura.'
  return null
}
=======
>>>>>>> Stashed changes
