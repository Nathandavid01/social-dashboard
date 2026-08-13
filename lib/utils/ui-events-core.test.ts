import { describe, it, expect } from 'vitest'
import {
  sanitizeLabel,
  sanitizePath,
  isIgnoredPath,
  isLoggableClickTarget,
  closestLoggableTarget,
  labelFromTarget,
  targetName,
  resolveClick,
  shouldDedupe,
  eventDedupeKey,
  parseUiEventBatch,
  dayBoundsIso,
  pruneBefore,
  UI_EVENT_LABEL_MAX,
  UI_EVENT_BATCH_MAX,
  UI_EVENT_DEDUPE_MS,
  UI_EVENT_RETENTION_DAYS,
} from './ui-events-core'

describe('sanitizeLabel', () => {
  it('trims, collapses whitespace and caps at 80 chars', () => {
    expect(sanitizeLabel('  Guardar   caption  ')).toBe('Guardar caption')
    const long = 'x'.repeat(200)
    expect(sanitizeLabel(long)).toBe('x'.repeat(UI_EVENT_LABEL_MAX))
  })

  it('drops control characters and empty/non-string input', () => {
    expect(sanitizeLabel('ok\u0000\nthere')).toBe('ok there')
    expect(sanitizeLabel('')).toBe('')
    expect(sanitizeLabel(null)).toBe('')
    expect(sanitizeLabel(12)).toBe('')
  })
})

describe('sanitizePath', () => {
  it('keeps dashboard paths and optional short query', () => {
    expect(sanitizePath('/entregas')).toBe('/entregas')
    expect(sanitizePath('/clients/abc?tab=x')).toBe('/clients/abc?tab=x')
  })

  it('rejects anything that is not a same-origin path', () => {
    expect(sanitizePath('https://evil.test/x')).toBeNull()
    expect(sanitizePath('javascript:alert(1)')).toBeNull()
    expect(sanitizePath('')).toBeNull()
    expect(sanitizePath('../etc/passwd')).toBeNull()
  })
})

describe('isIgnoredPath', () => {
  it('ignores the session log page so watching it does not write more rows', () => {
    expect(isIgnoredPath('/actividad')).toBe(true)
    expect(isIgnoredPath('/actividad/')).toBe(true)
    expect(isIgnoredPath('/entregas')).toBe(false)
    expect(isIgnoredPath('/home')).toBe(false)
  })
})

describe('click targeting', () => {
  it('accepts button, link, role=button and data-log; rejects bare divs and fields', () => {
    document.body.innerHTML = `
      <button id="b">Guardar</button>
      <a id="a" href="/x">Ir</a>
      <div id="rb" role="button">Más</div>
      <span id="dl" data-log="Filtro Nathan">x</span>
      <div id="div">nada</div>
      <input id="in" value="secreto" />
      <textarea id="ta">secreto</textarea>
    `
    expect(isLoggableClickTarget(document.getElementById('b')!)).toBe(true)
    expect(isLoggableClickTarget(document.getElementById('a')!)).toBe(true)
    expect(isLoggableClickTarget(document.getElementById('rb')!)).toBe(true)
    expect(isLoggableClickTarget(document.getElementById('dl')!)).toBe(true)
    expect(isLoggableClickTarget(document.getElementById('div')!)).toBe(false)
    expect(isLoggableClickTarget(document.getElementById('in')!)).toBe(false)
    expect(isLoggableClickTarget(document.getElementById('ta')!)).toBe(false)
  })

  it('walks up to the nearest loggable ancestor', () => {
    document.body.innerHTML = `<button id="b"><span id="inner">Publicar</span></button>`
    const inner = document.getElementById('inner')!
    const found = closestLoggableTarget(inner)
    expect(found?.id).toBe('b')
    expect(labelFromTarget(found!)).toBe('Publicar')
    expect(targetName(found!)).toBe('button')
  })

  it('prefers data-log then aria-label over visible text', () => {
    document.body.innerHTML = `<button id="b" data-log="Enviar lote" aria-label="Enviar">OK</button>`
    expect(labelFromTarget(document.getElementById('b')!)).toBe('Enviar lote')
    document.body.innerHTML = `<button id="b" aria-label="Cerrar panel">×</button>`
    expect(labelFromTarget(document.getElementById('b')!)).toBe('Cerrar panel')
  })

  it('never records a typed field value even if the click landed there', () => {
    document.body.innerHTML = `<input id="in" value="cliente secreto" />`
    expect(resolveClick(document.getElementById('in'), '/entregas')).toBeNull()
  })

  it('returns a click event for a real button and skips /actividad', () => {
    document.body.innerHTML = `<button id="b">Guardar</button>`
    expect(resolveClick(document.getElementById('b'), '/entregas')).toEqual({
      kind: 'click',
      path: '/entregas',
      label: 'Guardar',
      target: 'button',
    })
    expect(resolveClick(document.getElementById('b'), '/actividad')).toBeNull()
  })

  it('skips clicks inside data-ui-events-ignore', () => {
    document.body.innerHTML = `<div data-ui-events-ignore><button id="b">X</button></div>`
    expect(resolveClick(document.getElementById('b'), '/home')).toBeNull()
  })
})

describe('dedupe', () => {
  it('collapses the same kind+path+label inside 400ms', () => {
    const key = eventDedupeKey('click', '/home', 'Guardar')
    expect(shouldDedupe({ key, at: 1000 }, key, 1000 + UI_EVENT_DEDUPE_MS - 1)).toBe(true)
    expect(shouldDedupe({ key, at: 1000 }, key, 1000 + UI_EVENT_DEDUPE_MS)).toBe(false)
    expect(shouldDedupe({ key, at: 1000 }, eventDedupeKey('click', '/home', 'Otro'), 1100)).toBe(false)
    expect(shouldDedupe(null, key, 1000)).toBe(false)
  })
})

describe('parseUiEventBatch', () => {
  it('accepts a valid batch and drops junk rows', () => {
    const parsed = parseUiEventBatch({
      events: [
        { kind: 'click', path: '/home', label: '  Ir  ', target: 'button' },
        { kind: 'navigate', path: '/entregas', label: '/entregas' },
        { kind: 'click', path: 'nope', label: 'x' },
        { kind: 'explode', path: '/home', label: 'x' },
      ],
    })
    expect(parsed.error).toBeUndefined()
    expect(parsed.events).toEqual([
      { kind: 'click', path: '/home', label: 'Ir', target: 'button' },
      { kind: 'navigate', path: '/entregas', label: '/entregas', target: null },
    ])
  })

  it('rejects a missing/non-array payload and caps the batch', () => {
    expect(parseUiEventBatch(null).error).toBeTruthy()
    expect(parseUiEventBatch({ events: 'nope' }).error).toBeTruthy()
    const tooMany = {
      events: Array.from({ length: UI_EVENT_BATCH_MAX + 5 }, (_, i) => ({
        kind: 'click',
        path: '/home',
        label: `b${i}`,
      })),
    }
    const parsed = parseUiEventBatch(tooMany)
    expect(parsed.error).toBeUndefined()
    expect(parsed.events).toHaveLength(UI_EVENT_BATCH_MAX)
  })
})

describe('day bounds and retention', () => {
  it('anchors "today" to midnight America/Puerto_Rico (AST, UTC-4, no DST)', () => {
    const { gte, lt } = dayBoundsIso('2026-08-13')
    expect(gte).toBe('2026-08-13T04:00:00.000Z')
    expect(lt).toBe('2026-08-14T04:00:00.000Z')
  })

  it(`prunes rows older than ${7} days`, () => {
    expect(UI_EVENT_RETENTION_DAYS).toBe(7)
    const now = new Date('2026-08-13T16:00:00.000Z')
    expect(pruneBefore(now).toISOString()).toBe('2026-08-06T16:00:00.000Z')
  })
})
