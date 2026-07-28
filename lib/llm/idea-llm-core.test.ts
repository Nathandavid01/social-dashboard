import { describe, it, expect } from 'vitest'
import {
  resolveIdeaProvider,
  ideaModelId,
  requiredIdeaKeyName,
  ideaConfigError,
  CLAUDE_IDEA_MODEL,
  type IdeaEnv,
} from './idea-llm-core'

const env = (o: Partial<IdeaEnv> = {}): IdeaEnv => ({ ...o })

describe('resolveIdeaProvider — Grok por defecto', () => {
  it('sin CAPTION_PROVIDER usa Grok', () => {
    expect(resolveIdeaProvider(env())).toBe('grok')
  })
  it('un valor desconocido también cae en Grok', () => {
    expect(resolveIdeaProvider(env({ CAPTION_PROVIDER: 'gemini' }))).toBe('grok')
    expect(resolveIdeaProvider(env({ CAPTION_PROVIDER: '' }))).toBe('grok')
  })
  it('solo "claude"/"anthropic" cambian a Anthropic', () => {
    expect(resolveIdeaProvider(env({ CAPTION_PROVIDER: 'claude' }))).toBe('claude')
    expect(resolveIdeaProvider(env({ CAPTION_PROVIDER: 'ANTHROPIC' }))).toBe('claude')
  })
  it('las ideas siguen el MISMO switch que los captions', () => {
    expect(resolveIdeaProvider(env({ CAPTION_PROVIDER: 'grok' }))).toBe('grok')
  })
})

describe('ideaModelId', () => {
  it('por defecto el modelo de Grok', () => {
    expect(ideaModelId(env())).toMatch(/^grok/)
  })
  it('GROK_IDEA_MODEL manda cuando está puesto', () => {
    expect(ideaModelId(env({ GROK_IDEA_MODEL: 'grok-otro' }))).toBe('grok-otro')
  })
  it('un override vacío no pisa el default', () => {
    expect(ideaModelId(env({ GROK_IDEA_MODEL: '   ' }))).toMatch(/^grok/)
  })
  it('con claude usa el modelo de Anthropic', () => {
    expect(ideaModelId(env({ CAPTION_PROVIDER: 'claude' }))).toBe(CLAUDE_IDEA_MODEL)
  })
})

describe('requiredIdeaKeyName / ideaConfigError', () => {
  it('Grok exige XAI_API_KEY', () => {
    expect(requiredIdeaKeyName(env())).toBe('XAI_API_KEY')
    expect(ideaConfigError(env())).toMatch(/XAI_API_KEY/)
    expect(ideaConfigError(env({ XAI_API_KEY: 'x' }))).toBeNull()
  })
  it('Claude exige ANTHROPIC_API_KEY', () => {
    const e = env({ CAPTION_PROVIDER: 'claude' })
    expect(requiredIdeaKeyName(e)).toBe('ANTHROPIC_API_KEY')
    expect(ideaConfigError(e)).toMatch(/ANTHROPIC_API_KEY/)
    expect(ideaConfigError({ ...e, ANTHROPIC_API_KEY: 'k' })).toBeNull()
  })
  it('una llave en blanco no cuenta como configurada', () => {
    expect(ideaConfigError(env({ XAI_API_KEY: '   ' }))).toMatch(/XAI_API_KEY/)
  })
  it('tener la llave del OTRO proveedor no sirve', () => {
    expect(ideaConfigError(env({ ANTHROPIC_API_KEY: 'k' }))).toMatch(/XAI_API_KEY/)
  })
})
