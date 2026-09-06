import { describe, it, expect } from 'vitest'
import {
  imageModelId,
  imageConfigError,
  clampImageCount,
  isGraphicAspectRatio,
  buildGrokImageRequest,
  buildGrokImageEditRequest,
  buildGrokConceptRequest,
  parseGrokImageResponse,
  GROK_IMAGE_MODEL,
  GROK_IMAGE_GENERATIONS_URL,
  GROK_IMAGE_EDITS_URL,
  GRAPHIC_ASPECT_RATIOS,
} from './image-llm-core'

describe('imageModelId', () => {
  it('returns the default Grok Imagine model', () => {
    expect(imageModelId({})).toBe(GROK_IMAGE_MODEL)
  })
  it('honors a GROK_IMAGE_MODEL override', () => {
    expect(imageModelId({ GROK_IMAGE_MODEL: 'grok-imagine-image' })).toBe('grok-imagine-image')
  })
  it('ignores a blank override', () => {
    expect(imageModelId({ GROK_IMAGE_MODEL: '  ' })).toBe(GROK_IMAGE_MODEL)
  })
})

describe('imageConfigError', () => {
  it('flags a missing XAI_API_KEY in Spanish', () => {
    expect(imageConfigError({})).toMatch(/XAI_API_KEY/)
    expect(imageConfigError({ XAI_API_KEY: ' ' })).toMatch(/XAI_API_KEY/)
  })
  it('passes when the key is present', () => {
    expect(imageConfigError({ XAI_API_KEY: 'xai-123' })).toBeNull()
  })
})

describe('clampImageCount', () => {
  it('clamps to the 1–10 API range and defaults to 1', () => {
    expect(clampImageCount(undefined)).toBe(1)
    expect(clampImageCount(0)).toBe(1)
    expect(clampImageCount(4)).toBe(4)
    expect(clampImageCount(99)).toBe(10)
    expect(clampImageCount(2.7)).toBe(2)
  })
})

describe('isGraphicAspectRatio', () => {
  it('accepts every offered ratio and rejects anything else', () => {
    for (const r of GRAPHIC_ASPECT_RATIOS) expect(isGraphicAspectRatio(r.value)).toBe(true)
    expect(isGraphicAspectRatio('7:5')).toBe(false)
    expect(isGraphicAspectRatio('')).toBe(false)
  })
})

describe('buildGrokImageRequest', () => {
  it('targets the xAI image-generations endpoint with bearer auth', () => {
    const req = buildGrokImageRequest({ prompt: 'p', apiKey: 'xai-k', model: 'm', n: 2, aspectRatio: '1:1' })
    expect(req.url).toBe(GROK_IMAGE_GENERATIONS_URL)
    expect(req.headers.Authorization).toBe('Bearer xai-k')
    expect(req.headers['Content-Type']).toBe('application/json')
  })
  it('asks for base64 so we can persist the bytes ourselves', () => {
    const req = buildGrokImageRequest({ prompt: 'un flyer', apiKey: 'k', model: 'm', n: 3, aspectRatio: '9:16' })
    const body = JSON.parse(req.body)
    expect(body).toEqual({
      model: 'm',
      prompt: 'un flyer',
      n: 3,
      aspect_ratio: '9:16',
      response_format: 'b64_json',
    })
  })
  it('clamps n into the API range', () => {
    const body = JSON.parse(
      buildGrokImageRequest({ prompt: 'p', apiKey: 'k', model: 'm', n: 50, aspectRatio: '1:1' }).body,
    )
    expect(body.n).toBe(10)
  })
})

describe('buildGrokConceptRequest', () => {
  it('sends a plain text chat request without a photo', () => {
    const req = buildGrokConceptRequest({ prompt: 'mejora esto', apiKey: 'k', model: 'grok-4-1-fast-non-reasoning' })
    expect(req.url).toBe('https://api.x.ai/v1/chat/completions')
    const body = JSON.parse(req.body)
    expect(body.model).toBe('grok-4-1-fast-non-reasoning')
    expect(body.messages).toEqual([{ role: 'user', content: 'mejora esto' }])
    expect(body.max_tokens).toBe(400)
  })
  it('sends multimodal content blocks when a photo URL is given', () => {
    const req = buildGrokConceptRequest({
      prompt: 'mejora esto',
      apiKey: 'k',
      model: 'grok-4.6',
      imageUrl: 'https://cdn.example.com/foto.jpg',
    })
    const body = JSON.parse(req.body)
    expect(body.messages[0].content).toEqual([
      { type: 'image_url', image_url: { url: 'https://cdn.example.com/foto.jpg' } },
      { type: 'text', text: 'mejora esto' },
    ])
  })
})

describe('buildGrokImageEditRequest', () => {
  it('targets the edits endpoint with the source photo as image_url', () => {
    const req = buildGrokImageEditRequest({
      prompt: 'convierte esta foto en un arte',
      apiKey: 'xai-k',
      model: 'm',
      imageUrl: 'https://cdn.example.com/foto.jpg',
    })
    expect(req.url).toBe(GROK_IMAGE_EDITS_URL)
    expect(req.headers.Authorization).toBe('Bearer xai-k')
    const body = JSON.parse(req.body)
    expect(body).toEqual({
      model: 'm',
      prompt: 'convierte esta foto en un arte',
      image: { type: 'image_url', url: 'https://cdn.example.com/foto.jpg' },
      response_format: 'b64_json',
    })
  })
})

describe('parseGrokImageResponse', () => {
  it('extracts base64 payloads in order', () => {
    const out = parseGrokImageResponse({ data: [{ b64_json: 'aaa' }, { b64_json: 'bbb' }] })
    expect(out).toEqual(['aaa', 'bbb'])
  })
  it('drops entries without a base64 payload', () => {
    const out = parseGrokImageResponse({ data: [{ url: 'https://x' }, { b64_json: 'ccc' }, {}] })
    expect(out).toEqual(['ccc'])
  })
  it('returns [] for malformed responses', () => {
    expect(parseGrokImageResponse(null)).toEqual([])
    expect(parseGrokImageResponse({})).toEqual([])
    expect(parseGrokImageResponse({ data: 'nope' })).toEqual([])
  })
})
