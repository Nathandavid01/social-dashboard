import { describe, it, expect } from 'vitest'
import {
  buildSceneCheckRequest,
  parseSceneCheckResponse,
  sceneCheckModelId,
  SCENE_CHECK_MODEL,
} from './scene-check-core'

const frames = [
  { b64: 'AAAA', second: 2 },
  { b64: 'BBBB', second: 10 },
]

describe('sceneCheckModelId', () => {
  it('usa el default', () => {
    expect(sceneCheckModelId({})).toBe(SCENE_CHECK_MODEL)
  })
  it('respeta el override por env', () => {
    expect(sceneCheckModelId({ GROK_SCENE_CHECK_MODEL: 'grok-x' })).toBe('grok-x')
  })
})

describe('buildSceneCheckRequest', () => {
  it('arma un request OpenAI-compatible con las imágenes en data URLs', () => {
    const req = buildSceneCheckRequest({ frames, apiKey: 'k', model: 'm' })
    expect(req.url).toContain('api.x.ai')
    expect(req.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(req.body)
    expect(body.model).toBe('m')
    const content = body.messages[0].content
    // 1 bloque de texto + 1 image_url por frame
    expect(content.filter((c: { type: string }) => c.type === 'image_url')).toHaveLength(2)
    expect(content[0].type).toBe('text')
    expect(content[0].text).toMatch(/ortografía/i)
    expect(content[1].image_url.url).toBe('data:image/jpeg;base64,AAAA')
    // pide JSON estricto
    expect(body.response_format?.type).toBe('json_object')
  })
})

describe('parseSceneCheckResponse', () => {
  const wrap = (content: string) => ({ choices: [{ message: { content } }] })

  it('parsea issues y mapea frameIndex → approxSecond', () => {
    const json = wrap(JSON.stringify({
      issues: [{ text: 'exelente', problem: 'falta la c: «excelente»', frameIndex: 1 }],
      videoTopic: 'Promo de uniformes',
    }))
    const out = parseSceneCheckResponse(json, frames)
    expect(out).toEqual({
      issues: [{ text: 'exelente', problem: 'falta la c: «excelente»', approxSecond: 10 }],
      videoTopic: 'Promo de uniformes',
    })
  })

  it('frameIndex fuera de rango o ausente → approxSecond null', () => {
    const json = wrap(JSON.stringify({ issues: [{ text: 'x', problem: 'y', frameIndex: 99 }], videoTopic: null }))
    expect(parseSceneCheckResponse(json, frames)!.issues[0].approxSecond).toBeNull()
  })

  it('sin issues → lista vacía', () => {
    const json = wrap(JSON.stringify({ issues: [], videoTopic: 'algo' }))
    expect(parseSceneCheckResponse(json, frames)).toEqual({ issues: [], videoTopic: 'algo' })
  })

  it('content con texto alrededor del JSON (```json ... ```) igual parsea', () => {
    const json = wrap('```json\n{"issues":[],"videoTopic":"t"}\n```')
    expect(parseSceneCheckResponse(json, frames)).toEqual({ issues: [], videoTopic: 't' })
  })

  it('respuesta sin JSON válido → null', () => {
    expect(parseSceneCheckResponse(wrap('no hay nada'), frames)).toBeNull()
  })

  it('respuesta vacía / shape inesperado → null', () => {
    expect(parseSceneCheckResponse({}, frames)).toBeNull()
    expect(parseSceneCheckResponse(null, frames)).toBeNull()
  })

  it('issues con campos no-string se descartan', () => {
    const json = wrap(JSON.stringify({ issues: [{ text: 5, problem: null }], videoTopic: null }))
    expect(parseSceneCheckResponse(json, frames)).toEqual({ issues: [], videoTopic: null })
  })
})
