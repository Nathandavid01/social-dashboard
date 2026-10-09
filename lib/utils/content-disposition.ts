/**
 * `Content-Disposition: attachment` safe for any file name (RFC 6266 + 5987).
 *
 * R2 forwards the header value as raw bytes: `filename="La Güira 48.mp4"` reached
 * the browser as UTF-8 bytes read as latin1 («La GÃ¼ira 48.mp4»). So the quoted
 * `filename` gets an ASCII-only fallback and the real name goes percent-encoded
 * in `filename*`, which every current browser prefers.
 */
export function attachmentDisposition(name: string | null | undefined, fallback = 'video.mp4'): string {
  const real = (name ?? '').replace(/[\r\n]/g, '').trim() || fallback
  const ascii =
    real
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e]/g, '-')
      .replace(/["\\]/g, '')
      .trim() || fallback
  const encoded = encodeURIComponent(real).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
