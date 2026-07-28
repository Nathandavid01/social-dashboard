import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import {
  buildGrokRequest,
  parseGrokResponse,
  parseClaudeContent,
} from './caption-llm-core'
import {
  resolveIdeaProvider,
  ideaModelId,
  ideaConfigError,
  type IdeaEnv,
} from './idea-llm-core'

export { ideaModelId, ideaConfigError } from './idea-llm-core'

/**
 * Run an Idea Lab prompt through the configured provider — Grok by default.
 *
 * The Anthropic path keeps `thinking: adaptive` + effort, which is what the
 * two-pass Idea Lab was tuned on. Grok has no equivalent knob, so on the
 * default path the model simply answers the prompt; the generate→critique
 * second pass still runs, since that lives in the route, not the provider.
 */
export async function runIdeaModel(prompt: string, maxTokens: number): Promise<string> {
  const env = process.env as IdeaEnv
  const configError = ideaConfigError(env)
  if (configError) throw new Error(configError)

  if (resolveIdeaProvider(env) === 'claude') {
    const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: ideaModelId(env),
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: prompt }],
    })
    return parseClaudeContent(message.content)
  }

  const req = buildGrokRequest({
    prompt,
    apiKey: env.XAI_API_KEY!,
    model: ideaModelId(env),
    maxTokens,
  })
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Grok API ${res.status}: ${detail.slice(0, 300)}`)
  }
  const json = await res.json().catch(() => null)
  return parseGrokResponse(json)
}
