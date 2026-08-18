/** How long a notification counts as “happening now” for the bell pulse. */
export const BELL_FRESH_MS = 5 * 60 * 1000

export function unreadCount(items: { read_at: string | null }[]): number {
  return items.filter((n) => !n.read_at).length
}

export function newestUnreadAt(items: { read_at: string | null; created_at: string }[]): number | null {
  let newest: number | null = null
  for (const n of items) {
    if (n.read_at) continue
    const t = Date.parse(n.created_at)
    if (!Number.isFinite(t)) continue
    if (newest == null || t > newest) newest = t
  }
  return newest
}

/**
 * Pulse only for unread activity the person has not opened yet, and only if
 * it landed recently. Old backlog stays as a quiet badge, not an alarm.
 */
export function shouldPulseBell(input: {
  items: { read_at: string | null; created_at: string }[]
  acknowledgedAt: number | null
  now?: number
  freshMs?: number
}): boolean {
  const now = input.now ?? Date.now()
  const freshMs = input.freshMs ?? BELL_FRESH_MS
  const newest = newestUnreadAt(input.items)
  if (newest == null) return false
  if (now - newest > freshMs) return false
  if (input.acknowledgedAt != null && newest <= input.acknowledgedAt) return false
  return true
}
