import { describe, it, expect } from 'vitest'
import { buildPostedLinks } from './posted-links'

const row = (ideaId: string, publicUrl: string | null, createdAt: string) => ({
  content_idea_id: ideaId,
  created_at: createdAt,
  metadata: publicUrl === null ? {} : { publicUrl },
})

describe('buildPostedLinks', () => {
  it('mapea cada idea a la URL pública que se envió', () => {
    const links = buildPostedLinks([row('a', 'https://cdn/x.mp4', '2026-08-15T10:00:00Z')])
    expect(links).toEqual({ a: 'https://cdn/x.mp4' })
  })

  it('con varios envíos de la misma idea gana el más reciente', () => {
    const links = buildPostedLinks([
      row('a', 'https://cdn/viejo.mp4', '2026-08-01T10:00:00Z'),
      row('a', 'https://cdn/nuevo.mp4', '2026-08-15T10:00:00Z'),
    ])
    expect(links).toEqual({ a: 'https://cdn/nuevo.mp4' })
  })

  it('un post anterior a v3.32 (sin publicUrl en metadata) no produce enlace', () => {
    expect(buildPostedLinks([row('a', null, '2026-08-15T10:00:00Z')])).toEqual({})
  })

  it('un envío nuevo sin publicUrl no borra el enlace del envío anterior', () => {
    const links = buildPostedLinks([
      row('a', 'https://cdn/x.mp4', '2026-08-01T10:00:00Z'),
      row('a', null, '2026-08-15T10:00:00Z'),
    ])
    expect(links).toEqual({ a: 'https://cdn/x.mp4' })
  })

  it('solo acepta URLs http(s) — nunca javascript: ni rutas sueltas', () => {
    const links = buildPostedLinks([
      // eslint-disable-next-line no-script-url
      row('a', 'javascript:alert(1)', '2026-08-15T10:00:00Z'),
      row('b', '/relativa.mp4', '2026-08-15T10:00:00Z'),
      row('c', 'https://cdn/ok.mp4', '2026-08-15T10:00:00Z'),
    ])
    expect(links).toEqual({ c: 'https://cdn/ok.mp4' })
  })

  it('lista vacía → mapa vacío', () => {
    expect(buildPostedLinks([])).toEqual({})
  })
})
