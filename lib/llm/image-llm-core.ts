/**
 * Pure, dependency-free core for AI graphic generation (Grok Imagine, xAI).
 *
 * Mirrors caption-llm-core.ts: everything here is a pure function (no network,
 * no SDK) so it's unit-testable without mocks. The actual HTTP call lives in
 * image-llm.ts. Images bill per image (~$0.04 c/u con grok-imagine-image-2.0),
 * not per token, so prompt length is free.
 */

/** Default Grok Imagine model. Override via GROK_IMAGE_MODEL without a deploy. */
export const GROK_IMAGE_MODEL = 'grok-imagine-image-2.0'
/** xAI's OpenAI-compatible image-generations endpoint. */
export const GROK_IMAGE_GENERATIONS_URL = 'https://api.x.ai/v1/images/generations'
/** xAI's image-edits endpoint (JSON, not multipart): photo in → graphic out. */
export const GROK_IMAGE_EDITS_URL = 'https://api.x.ai/v1/images/edits'

/** Env we read — kept narrow so tests can pass plain objects. */
export interface ImageEnv {
  XAI_API_KEY?: string
  /** Optional override of the Grok Imagine model id without a code change. */
  GROK_IMAGE_MODEL?: string
  // Index signature so NodeJS's ProcessEnv is assignable here.
  [key: string]: string | undefined
}

/** The model id to use (also recorded in generated_graphics). */
export function imageModelId(env: ImageEnv): string {
  return (env.GROK_IMAGE_MODEL ?? '').trim() || GROK_IMAGE_MODEL
}

/**
 * Returns a Spanish error message if the API key is missing, otherwise null.
 * Lets call sites fail fast before doing DB work.
 */
export function imageConfigError(env: ImageEnv): string | null {
  if (env.XAI_API_KEY && env.XAI_API_KEY.trim().length > 0) return null
  return 'XAI_API_KEY no está configurado en el servidor.'
}

/**
 * The aspect ratios we offer in the UI — a curated subset of what the API
 * accepts, named by where the graphic will live (labels shown to the team).
 */
export const GRAPHIC_ASPECT_RATIOS = [
  { value: '1:1', label: 'Cuadrado — post de feed' },
  { value: '3:4', label: 'Vertical — post de feed' },
  { value: '9:16', label: 'Story / Reel' },
  { value: '16:9', label: 'Horizontal — banner / YouTube' },
] as const

export type GraphicAspectRatio = (typeof GRAPHIC_ASPECT_RATIOS)[number]['value']

export function isGraphicAspectRatio(value: string): value is GraphicAspectRatio {
  return GRAPHIC_ASPECT_RATIOS.some((r) => r.value === value)
}

/** The API accepts n between 1 and 10. */
export function clampImageCount(n: number | undefined): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 1
  return Math.min(10, Math.max(1, Math.floor(n)))
}

export interface GrokImageRequest {
  url: string
  headers: Record<string, string>
  body: string
}

/**
 * Build the xAI image-generations request. We always ask for b64_json: the
 * hosted URLs xAI returns are temporary, so we persist the bytes to our own
 * storage instead of linking to something that expires.
 */
export function buildGrokImageRequest(input: {
  prompt: string
  apiKey: string
  model: string
  n: number
  aspectRatio: GraphicAspectRatio
}): GrokImageRequest {
  return {
    url: GROK_IMAGE_GENERATIONS_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      n: clampImageCount(input.n),
      aspect_ratio: input.aspectRatio,
      response_format: 'b64_json',
    }),
  }
}

/**
 * Build the xAI image-edits request: transform a team photo into a branded
 * graphic. The API only documents model/prompt/image — no n or aspect_ratio —
 * so variants are separate calls and the output follows the photo's ratio.
 */
export function buildGrokImageEditRequest(input: {
  prompt: string
  apiKey: string
  model: string
  /** Public URL of the source photo (xAI fetches it directly). */
  imageUrl: string
}): GrokImageRequest {
  return {
    url: GROK_IMAGE_EDITS_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      image: { type: 'image_url', url: input.imageUrl },
      response_format: 'b64_json',
    }),
  }
}

/**
 * Build the chat-completions request that improves a rough graphic concept
 * ("mejorar descripción"). Text-only uses the cheap caption model; with a
 * photo attached the caller passes the vision model and the photo travels as
 * an image_url block (same shape video-analysis uses).
 */
export function buildGrokConceptRequest(input: {
  prompt: string
  apiKey: string
  model: string
  imageUrl?: string
}): GrokImageRequest {
  const content = input.imageUrl
    ? [
        { type: 'image_url', image_url: { url: input.imageUrl } },
        { type: 'text', text: input.prompt },
      ]
    : input.prompt
  return {
    url: 'https://api.x.ai/v1/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 400,
      messages: [{ role: 'user', content }],
    }),
  }
}

/** Extract the base64 image payloads from an xAI image response, in order. */
export function parseGrokImageResponse(json: unknown): string[] {
  const data = (json as { data?: unknown })?.data
  if (!Array.isArray(data)) return []
  return data
    .map((d) => (d as { b64_json?: unknown })?.b64_json)
    .filter((b): b is string => typeof b === 'string' && b.length > 0)
}
