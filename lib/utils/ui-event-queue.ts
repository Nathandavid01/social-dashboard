import {
  UI_EVENT_BATCH_MAX,
  UI_EVENT_FLUSH_MS,
  UI_EVENT_FLUSH_SIZE,
  eventDedupeKey,
  shouldDedupe,
  type UiEventInput,
} from './ui-events-core'

export function createUiEventQueue(opts: {
  send: (events: UiEventInput[]) => Promise<void>
  now?: () => number
  max?: number
  intervalMs?: number
}) {
  const max = opts.max ?? UI_EVENT_FLUSH_SIZE
  const intervalMs = opts.intervalMs ?? UI_EVENT_FLUSH_MS
  let buffer: UiEventInput[] = []
  let last: { key: string; at: number } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false

  function schedule() {
    if (timer || destroyed) return
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, intervalMs)
  }

  function enqueue(event: UiEventInput) {
    if (destroyed) return
    const now = opts.now?.() ?? Date.now()
    const key = eventDedupeKey(event.kind, event.path, event.label)
    if (shouldDedupe(last, key, now)) return
    last = { key, at: now }
    buffer.push(event)
    if (buffer.length >= max) {
      void flush()
      return
    }
    schedule()
  }

  async function flush() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (buffer.length === 0) return
    const batch = buffer.splice(0, UI_EVENT_BATCH_MAX)
    try {
      await opts.send(batch)
    } catch {
      // Best-effort: a failed flush must never break the dashboard.
    }
  }

  function destroy() {
    destroyed = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { enqueue, flush, destroy }
}
