/**
 * Core puro (sin red, sin SDK) de la revisión de subtítulos con Grok visión.
 * El HTTP vive en lib/actions/scene-check.ts. Mismo patrón que caption-llm-core.
 */
import { GROK_CHAT_COMPLETIONS_URL, type GrokRequest } from './caption-llm-core'
import type { SceneCheckIssue } from './scene-check-types'

/** Modelo con visión: el default de captions también acepta imágenes. */
export const SCENE_CHECK_MODEL = 'grok-4-1-fast-non-reasoning'

export function sceneCheckModelId(env: { GROK_SCENE_CHECK_MODEL?: string }): string {
  return (env.GROK_SCENE_CHECK_MODEL ?? '').trim() || SCENE_CHECK_MODEL
}

const PROMPT = [
  'Estos frames vienen de un video en español para redes sociales, en orden cronológico.',
  'Lee TODO el texto visible en pantalla (subtítulos, títulos, textos quemados).',
  'Reporta SOLO errores de ortografía o gramática del español (tildes, letras, concordancia).',
  'NO reportes estilo, mayúsculas intencionales, anglicismos de marca ni emojis.',
  'Además describe en una oración de qué trata el video.',
  'Responde SOLO con JSON: {"issues":[{"text":"texto tal cual en pantalla","problem":"explicación corta del error y la corrección","frameIndex":N}],"videoTopic":"descripción de una oración"}',
  'Si no hay texto en pantalla o no hay errores, "issues" va vacío.',
].join('\n')

export function buildSceneCheckRequest(input: {
  frames: Array<{ b64: string; second: number }>
  apiKey: string
  model: string
}): GrokRequest {
  return {
    url: GROK_CHAT_COMPLETIONS_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          ...input.frames.map((f) => ({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${f.b64}` },
          })),
        ],
      }],
    }),
  }
}

/** Saca el primer objeto JSON del content (tolera ```json fences). */
function extractJson(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

export function parseSceneCheckResponse(
  json: unknown,
  frames: Array<{ second: number }>,
): { issues: SceneCheckIssue[]; videoTopic: string | null } | null {
  const choices = (json as { choices?: { message?: { content?: unknown } }[] })?.choices
  const content = choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  const parsed = extractJson(content) as {
    issues?: unknown
    videoTopic?: unknown
  } | null
  if (!parsed || !Array.isArray(parsed.issues)) return null

  const issues: SceneCheckIssue[] = parsed.issues.flatMap((raw) => {
    const r = raw as { text?: unknown; problem?: unknown; frameIndex?: unknown }
    if (typeof r.text !== 'string' || typeof r.problem !== 'string') return []
    const idx = typeof r.frameIndex === 'number' ? r.frameIndex : -1
    const second = idx >= 0 && idx < frames.length ? frames[idx].second : null
    return [{ text: r.text, problem: r.problem, approxSecond: second }]
  })
  const videoTopic = typeof parsed.videoTopic === 'string' && parsed.videoTopic.trim()
    ? parsed.videoTopic.trim() : null
  return { issues, videoTopic }
}
