import { describe, it, expect } from 'vitest'
import {
  resolveCaptionProvider,
  captionModelId,
  requiredKeyName,
  captionConfigError,
  buildGrokRequest,
  parseGrokResponse,
  parseClaudeContent,
  GROK_CAPTION_MODEL,
  CLAUDE_CAPTION_MODEL,
  GROK_CHAT_COMPLETIONS_URL,
} from './caption-llm-core'

describe('resolveCaptionProvider', () => {
  it('defaults to grok when unset', () => {
    expect(resolveCaptionProvider({})).toBe('grok')
  })
  it('defaults to grok for empty/unknown values', () => {
    expect(resolveCaptionProvider({ CAPTION_PROVIDER: '' })).toBe('grok')
    expect(resolveCaptionProvider({ CAPTION_PROVIDER: 'xyz' })).toBe('grok')
  })
  it('selects grok for grok/xai aliases', () => {
    expect(resolveCaptionProvider({ CAPTION_PROVIDER: 'grok' })).toBe('grok')
    expect(resolveCaptionProvider({ CAPTION_PROVIDER: ' GROK ' })).toBe('grok')
  })
  it('selects claude for claude/anthropic aliases (case/space-insensitive)', () => {
    expect(resolveCaptionProvider({ CAPTION_PROVIDER: 'claude' })).toBe('claude')
    expect(resolveCaptionProvider({ CAPTION_PROVIDER: ' Anthropic ' })).toBe('claude')
  })
})

describe('captionModelId', () => {
  it('returns the grok model by default', () => {
    expect(captionModelId({})).toBe(GROK_CAPTION_MODEL)
  })
  it('returns the claude model when provider is claude', () => {
    expect(captionModelId({ CAPTION_PROVIDER: 'claude' })).toBe(CLAUDE_CAPTION_MODEL)
  })
  it('honors a GROK_CAPTION_MODEL override only for grok', () => {
    expect(captionModelId({ GROK_CAPTION_MODEL: 'grok-4' })).toBe('grok-4')
    // override is ignored when claude is selected
    expect(captionModelId({ CAPTION_PROVIDER: 'claude', GROK_CAPTION_MODEL: 'grok-4' })).toBe(
      CLAUDE_CAPTION_MODEL,
    )
  })
})

describe('requiredKeyName', () => {
  it('is XAI_API_KEY for grok and ANTHROPIC_API_KEY for claude', () => {
    expect(requiredKeyName({})).toBe('XAI_API_KEY')
    expect(requiredKeyName({ CAPTION_PROVIDER: 'claude' })).toBe('ANTHROPIC_API_KEY')
  })
})

describe('captionConfigError', () => {
  it('flags the missing grok key by default', () => {
    expect(captionConfigError({})).toMatch(/XAI_API_KEY/)
  })
  it('passes when grok key present', () => {
    expect(captionConfigError({ XAI_API_KEY: 'xai-abc' })).toBeNull()
  })
  it('treats whitespace-only keys as missing', () => {
    expect(captionConfigError({ XAI_API_KEY: '   ' })).toMatch(/XAI_API_KEY/)
  })
  it('checks the claude key when claude is selected', () => {
    // grok key present but claude selected -> still errors on the claude key
    expect(captionConfigError({ CAPTION_PROVIDER: 'claude', XAI_API_KEY: 'xai-abc' })).toMatch(
      /ANTHROPIC_API_KEY/,
    )
    expect(
      captionConfigError({ CAPTION_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'sk-ant' }),
    ).toBeNull()
  })
})

describe('buildGrokRequest', () => {
  it('targets the xAI endpoint with bearer auth and OpenAI body shape', () => {
    const req = buildGrokRequest({
      prompt: 'write a caption',
      apiKey: 'xai-secret',
      model: 'grok-4-1-fast-non-reasoning',
      maxTokens: 1024,
    })
    expect(req.url).toBe(GROK_CHAT_COMPLETIONS_URL)
    expect(req.headers.Authorization).toBe('Bearer xai-secret')
    expect(req.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(req.body)
    expect(body).toEqual({
      model: 'grok-4-1-fast-non-reasoning',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'write a caption' }],
    })
  })
})

describe('parseGrokResponse', () => {
  it('extracts trimmed content from the first choice', () => {
    expect(
      parseGrokResponse({ choices: [{ message: { content: '  hello caption  ' } }] }),
    ).toBe('hello caption')
  })
  it('returns empty string on malformed / empty responses', () => {
    expect(parseGrokResponse({})).toBe('')
    expect(parseGrokResponse({ choices: [] })).toBe('')
    expect(parseGrokResponse({ choices: [{ message: {} }] })).toBe('')
    expect(parseGrokResponse(null)).toBe('')
    expect(parseGrokResponse({ choices: [{ message: { content: 123 } }] })).toBe('')
  })
})

describe('parseClaudeContent', () => {
  it('joins text blocks and ignores non-text', () => {
    expect(
      parseClaudeContent([
        { type: 'text', text: 'hello ' },
        { type: 'thinking', text: 'ignore me' },
        { type: 'text', text: 'world' },
      ]),
    ).toBe('hello world')
  })
  it('returns empty string for missing/empty input', () => {
    expect(parseClaudeContent(undefined)).toBe('')
    expect(parseClaudeContent([])).toBe('')
    expect(parseClaudeContent([{ type: 'image' }])).toBe('')
  })
})
