import 'server-only'
import {
  buildVisionRequest,
  parseVisionText,
  parseFiltroIRespuesta,
  visionModelId,
  grokVisionConfigError,
  type ErrorDetectado,
} from './grok-vision-core'

/**
 * Grok con imágenes — la llamada real.
 *
 * Aparte de `caption-llm.ts` a propósito: añadir visión no debe poder romper la
 * generación de captions, que lleva tiempo funcionando. Comparten proveedor,
 * no código.
 */

export type { ErrorDetectado }

export interface AnalisisVisual {
  errores: ErrorDetectado[]
  captionBase: string
  modelo: string
}

export async function analizarFrames(input: {
  prompt: string
  /** URLs públicas (prefirmadas de R2) o data URIs. */
  imagenes: string[]
  maxTokens?: number
}): Promise<AnalisisVisual> {
  const configError = grokVisionConfigError(process.env)
  if (configError) throw new Error(configError)

  const modelo = visionModelId(process.env)
  const req = buildVisionRequest({
    prompt: input.prompt,
    imagenes: input.imagenes,
    apiKey: process.env.XAI_API_KEY as string,
    model: modelo,
    // La tabla de errores puede ser larga y además viene el caption base.
    maxTokens: input.maxTokens ?? 4000,
  })

  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    throw new Error(`Grok visión ${res.status}: ${detalle.slice(0, 300)}`)
  }

  // Un 200 con cuerpo que no es JSON (página de error de un proxy) no debe
  // reventar: parseVisionText(null) → '' → el llamador lo trata como fallo.
  const json = await res.json().catch(() => null)
  const texto = parseVisionText(json)
  if (!texto) throw new Error('Grok no devolvió análisis')

  return { ...parseFiltroIRespuesta(texto), modelo }
}
