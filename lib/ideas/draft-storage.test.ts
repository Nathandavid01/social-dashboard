import { describe, it, expect, beforeEach } from 'vitest'
import { emptyIdeaRow, type IdeaRow } from './batch-entry'
import {
  clearDraft,
  draftStorageKey,
  isDraftDirty,
  loadDraft,
  parseDraft,
  saveDraft,
  serializeDraft,
} from './draft-storage'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    key: (i) => [...map.keys()][i] ?? null,
  }
}

const row = (over: Partial<IdeaRow> = {}): IdeaRow => ({ ...emptyIdeaRow(), ...over })

describe('draftStorageKey', () => {
  it('incluye clientId y usa anon sin usuario', () => {
    expect(draftStorageKey('c1')).toBe('nm-escribir-ideas-draft:anon:c1')
  })
  it('incluye userId cuando hay sesión', () => {
    expect(draftStorageKey('c1', 'u-9')).toBe('nm-escribir-ideas-draft:u-9:c1')
  })
})

describe('isDraftDirty', () => {
  it('sucio solo si hay filas escritas', () => {
    expect(isDraftDirty([emptyIdeaRow()])).toBe(false)
    expect(isDraftDirty([row({ title: 'A' }), emptyIdeaRow()])).toBe(true)
  })
})

describe('parseDraft / serializeDraft', () => {
  it('restaura filas del mismo cliente', () => {
    const raw = serializeDraft({
      clientId: 'c1',
      rows: [row({ title: 'Tour' }), emptyIdeaRow()],
      savedAt: '2026-01-01T00:00:00.000Z',
    })
    const rows = parseDraft(raw, 'c1')
    expect(rows).toBeTruthy()
    expect(rows![0].title).toBe('Tour')
    expect(rows!.at(-1)).toEqual(emptyIdeaRow())
  })

  it('rechaza borrador de otro cliente', () => {
    const raw = serializeDraft({
      clientId: 'c1',
      rows: [row({ title: 'Tour' })],
      savedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(parseDraft(raw, 'c2')).toBeNull()
  })

  it('rechaza JSON inválido o vacío', () => {
    expect(parseDraft('nope', 'c1')).toBeNull()
    expect(parseDraft(null, 'c1')).toBeNull()
    expect(parseDraft(serializeDraft({
      clientId: 'c1',
      rows: [emptyIdeaRow()],
      savedAt: '2026-01-01T00:00:00.000Z',
    }), 'c1')).toBeNull()
  })
})

describe('saveDraft / loadDraft / clearDraft', () => {
  let storage: Storage

  beforeEach(() => {
    storage = memoryStorage()
  })

  it('guarda y restaura por cliente; otro cliente no ve el borrador', () => {
    saveDraft('c1', [row({ title: 'A', hook: 'x' }), emptyIdeaRow()], 'u1', storage)
    expect(loadDraft('c1', 'u1', storage)?.[0].title).toBe('A')
    expect(loadDraft('c2', 'u1', storage)).toBeNull()
  })

  it('claves por usuario: u1 y u2 no se pisan en el mismo cliente', () => {
    saveDraft('c1', [row({ title: 'De u1' })], 'u1', storage)
    saveDraft('c1', [row({ title: 'De u2' })], 'u2', storage)
    expect(loadDraft('c1', 'u1', storage)?.[0].title).toBe('De u1')
    expect(loadDraft('c1', 'u2', storage)?.[0].title).toBe('De u2')
  })

  it('limpia tras guardar vacío / clearDraft', () => {
    saveDraft('c1', [row({ title: 'A' })], null, storage)
    clearDraft('c1', null, storage)
    expect(loadDraft('c1', null, storage)).toBeNull()
    saveDraft('c1', [row({ title: 'B' })], null, storage)
    saveDraft('c1', [emptyIdeaRow()], null, storage)
    expect(loadDraft('c1', null, storage)).toBeNull()
  })
})
