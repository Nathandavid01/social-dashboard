import { describe, it, expect } from 'vitest'
import {
  buildTranscriptionRequest,
  parseTranscription,
  whisperApiConfigError,
  formatTranscripcionParaPrompt,
  WHISPERAPI_URL,
} from './whisperapi-core'

/**
 * WhisperAPI (Lemonfox) — la mitad pura: construir la petición y entender la
 * respuesta. Sin red, así que se puede probar sin clave.
 *
 * Se le pasa una URL prefirmada de R2 en vez del archivo: el video pesa
 * cientos de MB y el servidor no tiene por qué descargarlo — lo baja el
 * servicio de transcripción.
 */
describe('buildTranscriptionRequest', () => {
  const base = { url: 'https://r2.example/video.mp4?sig=abc', apiKey: 'k-123' }

  it('apunta al endpoint de WhisperAPI', () => {
    expect(buildTranscriptionRequest(base).url).toBe(WHISPERAPI_URL)
  })

  it('autentica con bearer', () => {
    expect(buildTranscriptionRequest(base).headers.Authorization).toBe('Bearer k-123')
  })

  /**
   * No se fija Content-Type a mano: con FormData lo pone fetch, incluido el
   * boundary. Ponerlo nosotros rompe el multipart.
   */
  it('no fija Content-Type — lo pone fetch con su boundary', () => {
    const headers = buildTranscriptionRequest(base).headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
    expect(headers['content-type']).toBeUndefined()
  })

  it('manda la URL remota, no un archivo', () => {
    const body = buildTranscriptionRequest(base).body
    expect(body.get('url')).toBe('https://r2.example/video.mp4?sig=abc')
    expect(body.get('file')).toBeNull()
  })

  it('pide español por defecto y transcribir, no traducir', () => {
    const body = buildTranscriptionRequest(base).body
    expect(body.get('language')).toBe('es')
    expect(body.get('task')).toBe('transcribe')
  })

  it('permite otro idioma', () => {
    const body = buildTranscriptionRequest({ ...base, language: 'en' }).body
    expect(body.get('language')).toBe('en')
  })
})

describe('parseTranscription', () => {
  it('extrae los segmentos con sus tiempos', () => {
    const out = parseTranscription({
      text: 'Hola a todos. Vamos pa la playa.',
      segments: [
        { start: 0, end: 2.4, text: 'Hola a todos.' },
        { start: 2.4, end: 5.1, text: ' Vamos pa la playa.' },
      ],
    })
    expect(out.texto).toBe('Hola a todos. Vamos pa la playa.')
    expect(out.segmentos).toEqual([
      { inicio: 0, fin: 2.4, texto: 'Hola a todos.' },
      { inicio: 2.4, fin: 5.1, texto: 'Vamos pa la playa.' },
    ])
  })

  /**
   * Los dos endpoints de WhisperAPI (nativo y compatible-OpenAI) dan la misma
   * forma para `segments`, pero no hay que confiar en que siempre venga todo:
   * un segmento sin texto no debe tumbar el análisis entero.
   */
  it('descarta segmentos sin texto y no revienta con campos que faltan', () => {
    const out = parseTranscription({
      text: 'Solo esto',
      segments: [
        { start: 0, end: 1, text: '   ' },
        { start: 1, text: 'Solo esto' },
        null,
      ],
    })
    expect(out.segmentos).toEqual([{ inicio: 1, fin: 1, texto: 'Solo esto' }])
  })

  it('sin segmentos devuelve el texto suelto', () => {
    expect(parseTranscription({ text: 'algo' })).toEqual({ texto: 'algo', segmentos: [] })
  })

  // Un 200 con HTML de un proxy no debe explotar: vacío y el llamador decide.
  it('una respuesta inservible da vacío en vez de lanzar', () => {
    expect(parseTranscription(null)).toEqual({ texto: '', segmentos: [] })
    expect(parseTranscription('<html>')).toEqual({ texto: '', segmentos: [] })
  })
})

describe('formatTranscripcionParaPrompt', () => {
  it('pone cada línea con su marca de tiempo para que el modelo pueda alinear', () => {
    const txt = formatTranscripcionParaPrompt([
      { inicio: 0, fin: 2.4, texto: 'Hola a todos' },
      { inicio: 2.4, fin: 5.15, texto: 'Vamos pa la playa' },
    ])
    expect(txt).toBe('[0.0s–2.4s] Hola a todos\n[2.4s–5.2s] Vamos pa la playa')
  })

  it('sin segmentos lo dice en vez de dejar un hueco', () => {
    expect(formatTranscripcionParaPrompt([])).toBe('(sin audio transcrito)')
  })
})

describe('whisperApiConfigError', () => {
  it('avisa cuando falta la clave', () => {
    expect(whisperApiConfigError({})).toMatch(/WHISPERAPI_API_KEY/)
    expect(whisperApiConfigError({ WHISPERAPI_API_KEY: '  ' })).toMatch(/WHISPERAPI_API_KEY/)
  })

  it('con clave no hay error', () => {
    expect(whisperApiConfigError({ WHISPERAPI_API_KEY: 'k' })).toBeNull()
  })
})
