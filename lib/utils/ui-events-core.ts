import { addDaysISO } from './deadlines'

export const UI_EVENT_KINDS = ['click', 'navigate'] as const
export type UiEventKind = (typeof UI_EVENT_KINDS)[number]

export const UI_EVENT_LABEL_MAX = 80
export const UI_EVENT_PATH_MAX = 200
export const UI_EVENT_BATCH_MAX = 40
export const UI_EVENT_DEDUPE_MS = 400
export const UI_EVENT_RETENTION_DAYS = 7
export const UI_EVENT_FLUSH_MS = 5_000
export const UI_EVENT_FLUSH_SIZE = 20
export const UI_EVENT_TZ = 'America/Puerto_Rico'

export interface UiEventInput {
  kind: UiEventKind
  path: string
  label: string
  target: string | null
}

const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function sanitizeLabel(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.slice(0, UI_EVENT_LABEL_MAX)
}

export function sanitizePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null
  const withoutHash = trimmed.split('#')[0] ?? trimmed
  if (!withoutHash.startsWith('/')) return null
  return withoutHash.slice(0, UI_EVENT_PATH_MAX)
}

export function isIgnoredPath(path: string): boolean {
  const clean = (sanitizePath(path) ?? path).split('?')[0] ?? path
  return clean === '/actividad' || clean.startsWith('/actividad/')
}

export function isLoggableClickTarget(el: Element): boolean {
  if (FIELD_TAGS.has(el.tagName)) return false
  if ((el as HTMLElement).isContentEditable) return false
  if (el.tagName === 'BUTTON' || el.tagName === 'A') return true
  if (el.getAttribute('role') === 'button') return true
  if (el.hasAttribute('data-log')) return true
  return false
}

export function closestLoggableTarget(el: Element | null): Element | null {
  let cur: Element | null = el
  while (cur) {
    if (isLoggableClickTarget(cur)) return cur
    cur = cur.parentElement
  }
  return null
}

export function labelFromTarget(el: Element): string {
  const dataLog = el.getAttribute('data-log')
  if (dataLog) return sanitizeLabel(dataLog)
  const aria = el.getAttribute('aria-label')
  if (aria) return sanitizeLabel(aria)
  const title = el.getAttribute('title')
  if (title) return sanitizeLabel(title)
  return sanitizeLabel(el.textContent ?? '')
}

export function targetName(el: Element): string {
  const role = el.getAttribute('role')
  if (role === 'button' && el.tagName !== 'BUTTON') return 'role=button'
  if (el.hasAttribute('data-log') && el.tagName !== 'BUTTON' && el.tagName !== 'A') {
    return 'data-log'
  }
  return el.tagName.toLowerCase()
}

export function resolveClick(target: EventTarget | null, path: string): UiEventInput | null {
  if (isIgnoredPath(path)) return null
  if (!(target instanceof Element)) return null
  if (target.closest('[data-ui-events-ignore]')) return null
  const el = closestLoggableTarget(target)
  if (!el) return null
  const label = labelFromTarget(el)
  if (!label) return null
  const cleanPath = sanitizePath(path)
  if (!cleanPath) return null
  return { kind: 'click', path: cleanPath, label, target: targetName(el) }
}

export function eventDedupeKey(kind: UiEventKind, path: string, label: string): string {
  return `${kind}\0${path}\0${label}`
}

export function shouldDedupe(
  prev: { key: string; at: number } | null,
  nextKey: string,
  now: number,
): boolean {
  if (!prev) return false
  if (prev.key !== nextKey) return false
  return now - prev.at < UI_EVENT_DEDUPE_MS
}

function isKind(value: unknown): value is UiEventKind {
  return value === 'click' || value === 'navigate'
}

export function parseUiEventBatch(body: unknown): { events: UiEventInput[]; error?: string } {
  if (!body || typeof body !== 'object' || !('events' in body)) {
    return { events: [], error: 'Cuerpo inválido' }
  }
  const raw = (body as { events: unknown }).events
  if (!Array.isArray(raw)) return { events: [], error: 'Cuerpo inválido' }

  const events: UiEventInput[] = []
  for (const row of raw.slice(0, UI_EVENT_BATCH_MAX)) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    if (!isKind(rec.kind)) continue
    const path = sanitizePath(rec.path)
    if (!path) continue
    const label = sanitizeLabel(rec.label) || (rec.kind === 'navigate' ? path : '')
    if (!label) continue
    const target = typeof rec.target === 'string' ? sanitizeLabel(rec.target) || null : null
    events.push({ kind: rec.kind, path, label, target })
  }
  return { events }
}

/** Inclusive start / exclusive end of a calendar day in America/Puerto_Rico (AST, UTC-4). */
export function dayBoundsIso(day: string): { gte: string; lt: string } {
  const next = addDaysISO(day, 1)
  return {
    gte: `${day}T04:00:00.000Z`,
    lt: `${next}T04:00:00.000Z`,
  }
}

export function pruneBefore(now: Date = new Date()): Date {
  return new Date(now.getTime() - UI_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}

export function isDayIso(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
