/**
 * Grok con imágenes — la mitad pura.
 *
 * Vive aparte de `caption-llm-core.ts` a propósito: el flujo de captions que ya
 * funciona no se toca por añadir visión. Aquí solo se construye la petición
 * multimodal y se entiende la respuesta.
 */

/** Modelo con entrada de imagen (docs de xAI). Sobreescribible por entorno. */
export const GROK_VISION_MODEL = 'grok-4.5'

const GROK_CHAT_COMPLETIONS_URL = 'https://api.x.ai/v1/chat/completions'

export interface GrokVisionEnv {
  XAI_API_KEY?: string
  /** Cambiar de modelo de visión sin tocar código. */
  GROK_VISION_MODEL?: string
  // Index signature para que el ProcessEnv de Node sea asignable, igual que en
  // CaptionEnv.
  [key: string]: string | undefined
}

export function visionModelId(env: GrokVisionEnv): string {
  return (env.GROK_VISION_MODEL ?? '').trim() || GROK_VISION_MODEL
}

export function grokVisionConfigError(env: GrokVisionEnv): string | null {
  if (!(env.XAI_API_KEY ?? '').trim()) {
    return 'XAI_API_KEY no está configurado en el servidor.'
  }
  return null
}

export interface VisionRequest {
  url: string
  headers: Record<string, string>
  body: string
}

export function buildVisionRequest(input: {
  prompt: string
  /** Data URIs `data:image/jpeg;base64,...` o URLs públicas. */
  imagenes: string[]
  apiKey: string
  model: string
  maxTokens: number
}): VisionRequest {
  // El texto va primero: el modelo tiene que saber qué se le pide antes de
  // mirar dos docenas de fotogramas sueltos.
  const content: unknown[] = [{ type: 'text', text: input.prompt }]
  for (const url of input.imagenes) {
    content.push({ type: 'image_url', image_url: { url } })
  }

  return {
    url: GROK_CHAT_COMPLETIONS_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens,
      messages: [{ role: 'user', content }],
    }),
  }
}

/** Extrae el texto de una respuesta con forma OpenAI. */
export function parseVisionText(json: unknown): string {
  const choices = (json as { choices?: { message?: { content?: unknown } }[] })?.choices
  const content = choices?.[0]?.message?.content
  return typeof content === 'string' ? content.trim() : ''
}

export interface ErrorDetectado {
  texto_incorrecto: string
  correccion: string
  tipo: string
  momento: string
}

const CAPTION_RE = /\*\*\s*Caption Base\s*:?\s*\*\*/i

/**
 * Parte la respuesta en los dos entregables del prompt: la tabla de errores y
 * el Caption Base.
 *
 * Ante cualquier duda devuelve MENOS, nunca inventado: una tabla con filas
 * falsas le hace perder el tiempo al editor buscando errores que no existen, y
 * eso destruye la confianza en la herramienta más rápido que no encontrarlos.
 */
export function parseFiltroIRespuesta(texto: string): {
  errores: ErrorDetectado[]
  captionBase: string
} {
  if (!texto || !texto.trim()) return { errores: [], captionBase: '' }

  const idx = texto.search(CAPTION_RE)
  const bloqueErrores = idx >= 0 ? texto.slice(0, idx) : texto
  const captionBase = idx >= 0 ? texto.slice(idx).replace(CAPTION_RE, '').trim() : ''

  return { errores: parseTabla(bloqueErrores), captionBase }
}

/** `|---|---|` — la línea que separa cabecera de datos en markdown. */
const esSeparador = (celda: string) => /^:?-{2,}:?$/.test(celda.replace(/\s/g, ''))

const esCabecera = (celdas: string[]) =>
  celdas[0].toLowerCase().startsWith('texto incorrecto')

function parseTabla(bloque: string): ErrorDetectado[] {
  const out: ErrorDetectado[] = []

  for (const linea of bloque.split('\n')) {
    const l = linea.trim()
    if (!l.startsWith('|')) continue

    const celdas = l.split('|').slice(1, -1).map((c) => c.trim())
    // Sin las 4 columnas no se sabe qué es qué; saltarla es más honesto que
    // adivinar el orden.
    if (celdas.length < 4) continue
    if (!celdas[0]) continue
    if (esSeparador(celdas[0])) continue
    if (esCabecera(celdas)) continue

    const [texto_incorrecto, correccion, tipo, momento] = celdas
    out.push({ texto_incorrecto, correccion, tipo, momento })
  }

  return out
}
