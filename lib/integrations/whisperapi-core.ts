/**
 * WhisperAPI (whisperapi.com, servido por Lemonfox) — la mitad pura.
 *
 * Se le pasa una URL prefirmada de R2 en vez del archivo: el video pesa
 * cientos de MB y la función no tiene por qué descargarlo — lo baja el
 * servicio. Por eso el límite que aplica es el de 500 MB por URL y no el de
 * 100 MB por subida directa.
 */

/**
 * Endpoint nativo de WhisperAPI. Es el que documenta el parámetro `url`.
 * Comparte backend (y por tanto claves) con el compatible-OpenAI de Lemonfox
 * en https://api.lemonfox.ai/v1/audio/transcriptions — comprobado: los dos
 * devuelven el mismo error de autenticación para la misma clave.
 */
export const WHISPERAPI_URL = 'https://transcribe.whisperapi.com'

export interface SegmentoTranscripcion {
  inicio: number
  fin: number
  texto: string
}

export interface WhisperEnv {
  WHISPERAPI_API_KEY?: string
  // Index signature para que el ProcessEnv de Node sea asignable, igual que en
  // CaptionEnv.
  [key: string]: string | undefined
}

export function whisperApiConfigError(env: WhisperEnv): string | null {
  if (!(env.WHISPERAPI_API_KEY ?? '').trim()) {
    return 'WHISPERAPI_API_KEY no está configurado en el servidor.'
  }
  return null
}

export interface TranscriptionRequest {
  url: string
  headers: Record<string, string>
  body: FormData
}

export function buildTranscriptionRequest(input: {
  /** URL prefirmada del video en R2 — pública y temporal, que es lo que necesita. */
  url: string
  apiKey: string
  language?: string
}): TranscriptionRequest {
  const body = new FormData()
  body.set('url', input.url)
  // Fijar el idioma evita que un video con una intro en inglés se detecte mal
  // y vuelva la transcripción entera en otro idioma.
  body.set('language', input.language ?? 'es')
  body.set('task', 'transcribe')

  return {
    url: WHISPERAPI_URL,
    // Sin Content-Type: con FormData lo pone fetch, con su boundary. Ponerlo a
    // mano rompe el multipart.
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body,
  }
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Entiende la respuesta. Defensivo a propósito: un segmento sin texto o una
 * respuesta que no es JSON (un HTML de proxy con status 200) devuelven vacío
 * en vez de tumbar el análisis entero.
 */
export function parseTranscription(json: unknown): {
  texto: string
  segmentos: SegmentoTranscripcion[]
} {
  if (!json || typeof json !== 'object') return { texto: '', segmentos: [] }

  const obj = json as { text?: unknown; segments?: unknown }
  const texto = typeof obj.text === 'string' ? obj.text.trim() : ''
  const crudos = Array.isArray(obj.segments) ? obj.segments : []

  const segmentos: SegmentoTranscripcion[] = []
  for (const s of crudos) {
    if (!s || typeof s !== 'object') continue
    const seg = s as { start?: unknown; end?: unknown; text?: unknown }
    const t = typeof seg.text === 'string' ? seg.text.trim() : ''
    if (!t) continue
    const inicio = num(seg.start)
    segmentos.push({ inicio, fin: seg.end == null ? inicio : num(seg.end), texto: t })
  }

  return { texto, segmentos }
}

/** `toFixed` sobre el double crudo redondea de forma inconsistente (5.15 → 5.1
 *  o 5.2 según el bit); redondear antes lo hace determinista. */
const un1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1)

/**
 * La transcripción tal como la ve el modelo. Cada línea con su marca de tiempo:
 * sin eso no puede cruzar "lo que se oye en el segundo 4.2" con "el subtítulo
 * del frame del segundo 4.2", que es justo el error que solo el audio detecta.
 */
export function formatTranscripcionParaPrompt(segmentos: SegmentoTranscripcion[]): string {
  if (!segmentos.length) return '(sin audio transcrito)'
  return segmentos.map((s) => `[${un1(s.inicio)}s–${un1(s.fin)}s] ${s.texto}`).join('\n')
}
