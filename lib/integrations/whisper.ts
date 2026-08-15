/**
 * Lemonfox / WhisperAPI — speech-to-text for caption grounding.
 * Pure request builder is unit-tested; the fetch lives here.
 */

export const WHISPER_TRANSCRIBE_URL = 'https://api.lemonfox.ai/v1/audio/transcriptions'

type WhisperEnv = { WHISPERAPI_API_KEY?: string; [key: string]: string | undefined }

export function whisperApiKey(env: WhisperEnv = process.env): string | null {
  const k = env.WHISPERAPI_API_KEY?.trim()
  return k && k.length > 0 ? k : null
}

export function buildWhisperForm(videoUrl: string): { url: string; fields: Record<string, string> } {
  return {
    url: WHISPER_TRANSCRIBE_URL,
    fields: {
      file: videoUrl,
      language: 'es',
      response_format: 'json',
    },
  }
}

export function parseWhisperTranscript(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const text = (body as { text?: unknown }).text
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function transcribeVideoFromUrl(
  videoUrl: string,
  env: WhisperEnv = process.env,
): Promise<string | null> {
  const key = whisperApiKey(env)
  if (!key) return null
  const req = buildWhisperForm(videoUrl)
  const form = new FormData()
  for (const [k, v] of Object.entries(req.fields)) form.append(k, v)
  try {
    const res = await fetch(req.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    if (!res.ok) {
      console.warn('[whisper] transcribe failed:', res.status)
      return null
    }
    return parseWhisperTranscript(await res.json())
  } catch (err) {
    console.warn('[whisper] transcribe error:', err instanceof Error ? err.message : err)
    return null
  }
}
