import { describe, it, expect } from 'vitest'
import { attachmentDisposition } from './content-disposition'

describe('attachmentDisposition', () => {
  it('keeps a plain ASCII name in both parameters', () => {
    expect(attachmentDisposition('delian-gingivitis-v5.mp4')).toBe(
      `attachment; filename="delian-gingivitis-v5.mp4"; filename*=UTF-8''delian-gingivitis-v5.mp4`,
    )
  })

  // Regresión (probado contra R2 de Entregas el 2026-09-25): `filename="La Güira 48.mp4"`
  // viajaba como bytes UTF-8 crudos y se leía «La GÃ¼ira 48.mp4».
  it('never puts raw non-ASCII bytes in the header', () => {
    const header = attachmentDisposition('La Güira 48.mp4')
    expect(header).toMatch(/^[\x20-\x7e]+$/)
    expect(header).toContain('filename="La Guira 48.mp4"')
    expect(header).toContain(`filename*=UTF-8''La%20G%C3%BCira%2048.mp4`)
  })

  it('degrades the em dash in the fallback and keeps it in filename*', () => {
    const header = attachmentDisposition('Buena Vida — Outfit v7.mp4')
    expect(header).toContain('filename="Buena Vida - Outfit v7.mp4"')
    expect(decodeURIComponent(header.split("UTF-8''")[1])).toBe('Buena Vida — Outfit v7.mp4')
  })

  it('strips quotes, backslashes and line breaks (no header injection)', () => {
    const header = attachmentDisposition('a"b\\c\r\nSet-Cookie: x.mp4')
    expect(header).not.toMatch(/[\r\n]/)
    expect(header).toContain('filename="abcSet-Cookie: x.mp4"')
  })

  it('encodes the characters RFC 5987 does not allow raw', () => {
    expect(attachmentDisposition("it's (v2)*.mp4")).toContain(`filename*=UTF-8''it%27s%20%28v2%29%2A.mp4`)
  })

  it('falls back when the name is empty or only whitespace', () => {
    expect(attachmentDisposition('')).toBe(`attachment; filename="video.mp4"; filename*=UTF-8''video.mp4`)
    expect(attachmentDisposition('   ', 'archivo')).toContain('filename="archivo"')
    expect(attachmentDisposition(null)).toContain('filename="video.mp4"')
  })
})
