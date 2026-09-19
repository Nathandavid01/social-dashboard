/**
 * Per-user notification *display* preferences.
 * Independent from nav_preferences. Missing keys default to ON.
 * These prefs never affect vote storage — only whether a toast paints.
 */

export type NotificationPreferences = {
  /** Toast when a client approves/rejects via /aprobacion (or /review). Default true. */
  client_review_toast?: boolean
}

export const NOTIFICATION_PREF_DEFAULTS = {
  client_review_toast: true,
} as const

const CLIENT_REVIEW_TOAST_KINDS = new Set(['review_approved', 'review_rejected'])

export function normalizeNotificationPreferences(
  raw: unknown,
): NotificationPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const src = raw as Record<string, unknown>
  const out: NotificationPreferences = {}
  if (typeof src.client_review_toast === 'boolean') {
    out.client_review_toast = src.client_review_toast
  }
  return out
}

/** Missing / undefined → ON (default). */
export function isClientReviewToastEnabled(
  prefs: NotificationPreferences | null | undefined,
): boolean {
  if (!prefs || prefs.client_review_toast === undefined) {
    return NOTIFICATION_PREF_DEFAULTS.client_review_toast
  }
  return prefs.client_review_toast
}

/**
 * Whether an incoming notification should fire a toast given the preference.
 * Non-client-review kinds are unaffected by this toggle.
 */
export function shouldShowClientReviewToast(input: {
  kind: string
  enabled: boolean
}): boolean {
  if (!CLIENT_REVIEW_TOAST_KINDS.has(input.kind)) return true
  return input.enabled
}
