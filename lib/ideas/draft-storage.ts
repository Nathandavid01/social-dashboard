import { countWritten, withTrailingBlank, type IdeaRow } from '@/lib/ideas/batch-entry'

/**
 * Borradores locales de "Escribir ideas".
 * Clave por cliente (y usuario si está disponible) para que cambiar de cliente
 * no pise el borrador de otro.
 */

const PREFIX = 'nm-escribir-ideas-draft'

export function draftStorageKey(clientId: string, userId?: string | null): string {
  const who = userId?.trim() || 'anon'
  return `${PREFIX}:${who}:${clientId}`
}

export interface IdeaBatchDraft {
  clientId: string
  userId?: string | null
  rows: IdeaRow[]
  savedAt: string
}

function isIdeaRow(v: unknown): v is IdeaRow {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    typeof r.title === 'string' &&
    typeof r.hook === 'string' &&
    typeof r.contentType === 'string' &&
    typeof r.shotType === 'string' &&
    typeof r.referenceUrl === 'string'
  )
}

/** ¿Hay filas escritas que se perderían al salir? */
export function isDraftDirty(rows: IdeaRow[]): boolean {
  return countWritten(rows) > 0
}

export function serializeDraft(draft: IdeaBatchDraft): string {
  return JSON.stringify(draft)
}

export function parseDraft(raw: string | null | undefined, clientId: string): IdeaRow[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<IdeaBatchDraft>
    if (parsed.clientId !== clientId) return null
    if (!Array.isArray(parsed.rows)) return null
    const rows = parsed.rows.filter(isIdeaRow)
    if (!isDraftDirty(rows)) return null
    return withTrailingBlank(rows)
  } catch {
    return null
  }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function loadDraft(
  clientId: string,
  userId?: string | null,
  storage: StorageLike | null = defaultStorage(),
): IdeaRow[] | null {
  if (!storage) return null
  return parseDraft(storage.getItem(draftStorageKey(clientId, userId)), clientId)
}

export function saveDraft(
  clientId: string,
  rows: IdeaRow[],
  userId?: string | null,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  const key = draftStorageKey(clientId, userId)
  if (!isDraftDirty(rows)) {
    storage.removeItem(key)
    return
  }
  const draft: IdeaBatchDraft = {
    clientId,
    userId: userId ?? null,
    rows: withTrailingBlank(rows),
    savedAt: new Date().toISOString(),
  }
  storage.setItem(key, serializeDraft(draft))
}

export function clearDraft(
  clientId: string,
  userId?: string | null,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return
  storage.removeItem(draftStorageKey(clientId, userId))
}
