import 'server-only'

import {
  buildGrokImageRequest,
  buildGrokImageEditRequest,
  buildGrokConceptRequest,
  parseGrokImageResponse,
  imageModelId,
  imageConfigError,
  type GraphicAspectRatio,
} from './image-llm-core'
import { GROK_CAPTION_MODEL, parseGrokResponse } from './caption-llm-core'
import { GROK_VISION_MODEL } from './video-analysis-core'

export { imageModelId, imageConfigError }

/**
 * Call Grok Imagine and return the generated images as base64 PNG payloads.
 * Billed per image (not tokens); the caller persists the bytes to storage
 * because xAI's hosted URLs are temporary.
 */
export async function generateGraphicImages(
  prompt: string,
  opts: { n: number; aspectRatio: GraphicAspectRatio },
): Promise<string[]> {
  const req = buildGrokImageRequest({
    prompt,
    apiKey: process.env.XAI_API_KEY ?? '',
    model: imageModelId(process.env),
    n: opts.n,
    aspectRatio: opts.aspectRatio,
  })
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Grok API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json().catch(() => null)
  return parseGrokImageResponse(json)
}

/**
 * Transform a team photo into a branded graphic via the edits endpoint.
 * One image per call (the API takes no `n`); returns the base64 PNG or null.
 */
export async function editGraphicImage(prompt: string, opts: { imageUrl: string }): Promise<string | null> {
  const req = buildGrokImageEditRequest({
    prompt,
    apiKey: process.env.XAI_API_KEY ?? '',
    model: imageModelId(process.env),
    imageUrl: opts.imageUrl,
  })
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Grok API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json().catch(() => null)
  return parseGrokImageResponse(json)[0] ?? null
}

/**
 * "Mejorar descripción": Grok texto (barato) sin foto, Grok visión con foto.
 * Devuelve la descripción mejorada en español, lista para editar.
 */
export async function enhanceConceptText(prompt: string, opts?: { imageUrl?: string | null }): Promise<string> {
  const imageUrl = opts?.imageUrl?.trim() || undefined
  const model = imageUrl
    ? (process.env.GROK_VISION_MODEL ?? '').trim() || GROK_VISION_MODEL
    : (process.env.GROK_CAPTION_MODEL ?? '').trim() || GROK_CAPTION_MODEL
  const req = buildGrokConceptRequest({ prompt, apiKey: process.env.XAI_API_KEY ?? '', model, imageUrl })
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Grok API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json().catch(() => null)
  return parseGrokResponse(json)
}
