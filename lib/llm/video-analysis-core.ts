/**
 * Núcleo puro del QC de video con Grok 4.6 (visión sobre frames).
 * Sin red ni SDK — testeable con objetos planos. La llamada HTTP vive en
 * video-analysis.ts. Patrón calcado de caption-llm-core.ts.
 */

export const GROK_VISION_MODEL = 'grok-4.6'
export const GROK_CHAT_COMPLETIONS_URL = 'https://api.x.ai/v1/chat/completions'

export interface VideoAnalysisEnv {
  XAI_API_KEY?: string
  GROK_VISION_MODEL?: string
  [key: string]: string | undefined
}

export function videoAnalysisModelId(env: VideoAnalysisEnv): string {
  return (env.GROK_VISION_MODEL ?? '').trim() || GROK_VISION_MODEL
}

export function videoAnalysisConfigError(env: VideoAnalysisEnv): string | null {
  if (env.XAI_API_KEY && env.XAI_API_KEY.trim().length > 0) return null
  return 'XAI_API_KEY no está configurado en el servidor.'
}

export interface VideoAnalysisContext {
  ideaTitle: string
  hook?: string | null
  clientName?: string | null
  brandVoice?: string | null
  captionLanguage?: string | null
  captionNotes?: string | null
}

export interface VideoAnalysisIssue { quote: string; problem: string; suggestion: string; t?: string }

export interface VideoAnalysisFindings {
  burned_captions: { text: string; issues: VideoAnalysisIssue[] }
  relevance: { verdict: 'ok' | 'warning'; explanation: string }
  visual_summary: string
}

const filled = (s?: string | null): boolean => !!s && s.trim().length > 0

export function buildVideoAnalysisPrompt(ctx: VideoAnalysisContext): string {
  const clientLines = [
    `- Cliente: ${filled(ctx.clientName) ? ctx.clientName : 'desconocido'}`,
    filled(ctx.brandVoice) && `- Voz de marca: ${ctx.brandVoice}`,
    filled(ctx.captionLanguage) && `- Idioma de los captions: ${ctx.captionLanguage}`,
    filled(ctx.captionNotes) && `- Reglas del cliente: ${ctx.captionNotes}`,
  ].filter(Boolean).join('\n')

  const ideaLines = [
    `- Título: ${ctx.ideaTitle}`,
    filled(ctx.hook) && `- Hook: ${ctx.hook}`,
  ].filter(Boolean).join('\n')

  return `Eres el control de calidad de NMedia PR, agencia de marketing puertorriqueña. Te paso fotogramas en orden cronológico de un video editado listo para aprobar.

CLIENTE:
${clientLines}

LA IDEA DEL VIDEO:
${ideaLines}

Los fotogramas vienen en orden cronológico, muestreados a varios por segundo (no son 8 tomas espaciadas: es casi cada fotograma del video). Los subtítulos quemados cambian rápido y un error puede aparecer en UN SOLO fotograma y desaparecer en el siguiente — revisa CADA fotograma sin saltarte ninguno, incluso si el texto se parece al del fotograma anterior.

TAREAS (en este orden):
1. CAPTIONS QUEMADOS: transcribe el texto que aparece EN PANTALLA dentro del video (subtítulos/captions integrados), fotograma por fotograma. Señala SOLO faltas objetivas: ortografía, tildes, concordancia, typos, palabras cortadas. IMPORTANTE: el español puertorriqueño, los anglicismos y el slang deliberado de la voz de marca NO son errores — no los "corrijas". Cuando puedas, incluye en cada issue el segundo aproximado ("t") donde aparece el error, tomándolo de la etiqueta "--- Fotograma N · t=Xs ---" que precede a cada imagen.
2. RELEVANCIA: ¿el contenido del video corresponde a este cliente y a esta idea? "ok" si claramente sí; "warning" si no se ve relación o parece de otro cliente, explicando por qué.
3. RESUMEN VISUAL: describe en 2-4 frases qué se ve (escenas, personas, acciones, tono, texto destacado) para que un copywriter escriba el caption sin ver el video.

Devuelve SOLO este JSON, sin explicaciones fuera de él:
{
  "burned_captions": { "text": "...", "issues": [{ "quote": "...", "problem": "...", "suggestion": "...", "t": "0.3s" }] },
  "relevance": { "verdict": "ok" | "warning", "explanation": "..." },
  "visual_summary": "..."
}`
}

export function buildVideoAnalysisRequest(input: {
  frames: string[]
  timestamps?: number[]
  prompt: string
  apiKey: string
  model: string
}): { url: string; headers: Record<string, string>; body: string } {
  const hasTimestamps = !!input.timestamps && input.timestamps.length === input.frames.length
  const imageContent = hasTimestamps
    ? input.frames.flatMap((url, i) => [
        { type: 'text', text: `--- Fotograma ${i + 1} · t=${input.timestamps![i]}s ---` },
        { type: 'image_url', image_url: { url } },
      ])
    : input.frames.map((url) => ({ type: 'image_url', image_url: { url } }))

  return {
    url: GROK_CHAT_COMPLETIONS_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: input.prompt },
          ...imageContent,
        ],
      }],
    }),
  }
}

/** Quita fences ```json ... ``` si el modelo los añadió. */
function stripFences(s: string): string {
  return s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

export function parseVideoAnalysisResponse(json: unknown): VideoAnalysisFindings | null {
  const choices = (json as { choices?: { message?: { content?: unknown } }[] })?.choices
  const content = choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  let raw: unknown
  try { raw = JSON.parse(stripFences(content)) } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!('visual_summary' in r) && !('burned_captions' in r) && !('relevance' in r)) return null

  const bc = (r.burned_captions ?? {}) as { text?: unknown; issues?: unknown }
  const issues = Array.isArray(bc.issues)
    ? bc.issues
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .map((i) => ({
          quote: typeof i.quote === 'string' ? i.quote : '',
          problem: typeof i.problem === 'string' ? i.problem : '',
          suggestion: typeof i.suggestion === 'string' ? i.suggestion : '',
          ...(typeof i.t === 'string' ? { t: i.t } : {}),
        }))
    : []
  const rel = (r.relevance ?? {}) as { verdict?: unknown; explanation?: unknown }

  return {
    burned_captions: { text: typeof bc.text === 'string' ? bc.text : '', issues },
    relevance: {
      verdict: rel.verdict === 'ok' ? 'ok' : 'warning',
      explanation: typeof rel.explanation === 'string' ? rel.explanation : '',
    },
    visual_summary: typeof r.visual_summary === 'string' ? r.visual_summary : '',
  }
}
