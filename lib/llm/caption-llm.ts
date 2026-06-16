import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import {
  resolveCaptionProvider,
  captionModelId,
  buildGrokRequest,
  parseGrokResponse,
  parseClaudeContent,
  type CaptionEnv,
} from './caption-llm-core'

export { captionModelId, captionConfigError } from './caption-llm-core'

/**
 * Generate a caption from a fully-built prompt, routing to the provider chosen
 * by CAPTION_PROVIDER (default Grok; set to "claude" to fall back to Anthropic).
 *
 * The prompt is built by the pure prompt builders (e.g. buildIdeaCaptionPrompt)
 * — this helper only owns the LLM call. Throws on missing key / API failure;
 * returns '' if the model produced no text (callers treat that as an error).
 */
export async function generateCaptionText(
  prompt: string,
  opts: { maxTokens?: number } = {},
): Promise<string> {
  const env = process.env as CaptionEnv
  const maxTokens = opts.maxTokens ?? 1024
  const provider = resolveCaptionProvider(env)

  if (provider === 'claude') {
    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurado en el servidor.')
    const anthropic = new Anthropic({ apiKey })
    const res = await anthropic.messages.create({
      model: captionModelId(env),
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })
    return parseClaudeContent(res.content)
  }

  // Grok (xAI) — OpenAI-compatible chat-completions over fetch (no extra dep).
  const apiKey = env.XAI_API_KEY
  if (!apiKey) throw new Error('XAI_API_KEY no está configurado en el servidor.')
  const req = buildGrokRequest({ prompt, apiKey, model: captionModelId(env), maxTokens })
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Grok API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json()
  return parseGrokResponse(json)
}
