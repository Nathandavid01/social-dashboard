import 'server-only'
import {
  buildTranscriptionRequest,
  parseTranscription,
  whisperApiConfigError,
  type SegmentoTranscripcion,
} from './whisperapi-core'

/**
 * WhisperAPI (whisperapi.com / Lemonfox) — la llamada real.
 *
 * Se le entrega una URL prefirmada de R2 y es el servicio quien descarga el
 * video: la función nunca carga cientos de MB en memoria, que es lo que la
 * mataría dentro del límite de tiempo.
 */

export type { SegmentoTranscripcion }

export interface Transcripcion {
  texto: string
  segmentos: SegmentoTranscripcion[]
}

export async function transcribirDesdeUrl(
  videoUrl: string,
  opts: { language?: string } = {},
): Promise<Transcripcion> {
  const configError = whisperApiConfigError(process.env)
  if (configError) throw new Error(configError)

  const req = buildTranscriptionRequest({
    url: videoUrl,
    apiKey: process.env.WHISPERAPI_API_KEY as string,
    language: opts.language,
  })

  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    // El 401 de este servicio dice "invalid API key ... or unused credits":
    // se pasa tal cual porque distingue clave mala de cuenta sin saldo, y eso
    // cambia lo que tiene que hacer quien lo lea.
    throw new Error(`WhisperAPI ${res.status}: ${detalle.slice(0, 300)}`)
  }

  const json = await res.json().catch(() => null)
  return parseTranscription(json)
}
