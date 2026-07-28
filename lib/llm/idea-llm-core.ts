import {
  resolveCaptionProvider,
  GROK_CAPTION_MODEL,
  type CaptionProvider,
  type CaptionEnv,
} from './caption-llm-core'

/**
 * Provider/model resolution for the Idea Lab. Mirrors the caption layer so the
 * whole app answers to ONE switch: Grok by default, Anthropic only when
 * CAPTION_PROVIDER says so.
 *
 * Ideas used to call Anthropic directly with a hardcoded model, which meant the
 * switch only ever moved captions.
 */

/** Anthropic model kept as the fallback path (two-pass + adaptive thinking). */
export const CLAUDE_IDEA_MODEL = 'claude-opus-4-8'

export interface IdeaEnv extends CaptionEnv {
  /** Optional override, same shape as GROK_CAPTION_MODEL. */
  GROK_IDEA_MODEL?: string
}

export function resolveIdeaProvider(env: IdeaEnv): CaptionProvider {
  return resolveCaptionProvider(env)
}

/** Model id for the resolved provider. */
export function ideaModelId(env: IdeaEnv): string {
  if (resolveIdeaProvider(env) === 'claude') return CLAUDE_IDEA_MODEL
  return (env.GROK_IDEA_MODEL ?? '').trim() || GROK_CAPTION_MODEL
}

/** Env var the resolved provider needs. */
export function requiredIdeaKeyName(env: IdeaEnv): 'XAI_API_KEY' | 'ANTHROPIC_API_KEY' {
  return resolveIdeaProvider(env) === 'claude' ? 'ANTHROPIC_API_KEY' : 'XAI_API_KEY'
}

/** Spanish error if the resolved provider's key is missing, else null. */
export function ideaConfigError(env: IdeaEnv): string | null {
  const key = requiredIdeaKeyName(env)
  const value = key === 'ANTHROPIC_API_KEY' ? env.ANTHROPIC_API_KEY : env.XAI_API_KEY
  if (value && value.trim()) return null
  return `${key} no está configurado en el servidor.`
}
