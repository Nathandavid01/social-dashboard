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

const clientContext = {
  name: 'Acme Pizza',
  industry: 'Restaurante',
  brandVoice: 'Cercana y familiar',
  ideaTitle: 'La pizza del viernes',
  ideaTopic: 'Promo de pizza artesanal',
  visualBrief: 'Mostrar el horno y el producto final',
}

describe('sceneCheckModelId', () => {
  it('usa el default', () => {
    expect(sceneCheckModelId({})).toBe(SCENE_CHECK_MODEL)
  })
  it('respeta el override por env', () => {
    expect(sceneCheckModelId({ GROK_SCENE_CHECK_MODEL: 'grok-x' })).toBe('grok-x')
  })
})

describe('buildSceneCheckRequest', () => {
  it('arma un request Responses API con las imágenes y el contexto del cliente', () => {
    const req = buildSceneCheckRequest({ frames, clientContext, apiKey: 'k', model: 'm' })
    expect(req.url).toBe('https://api.x.ai/v1/responses')
    expect(req.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(req.body)
    expect(body.model).toBe('m')
    expect(body.reasoning).toEqual({ effort: 'none' })
    expect(body.store).toBe(false)
    const content = body.input[0].content
    expect(content.filter((c: { type: string }) => c.type === 'input_image')).toHaveLength(2)
    expect(content[0].type).toBe('input_text')
    expect(content[0].text).toMatch(/ortografía/i)
    expect(content[0].text).toContain('Acme Pizza')
    expect(content[0].text).toContain('Restaurante')
    expect(content[1].image_url).toBe('data:image/jpeg;base64,AAAA')
    expect(body.text.format.type).toBe('json_schema')
    expect(body.text.format.schema.properties.clientMatchStatus.enum).toEqual([
      'match', 'mismatch', 'uncertain',
    ])
  })
})

describe('parseSceneCheckResponse', () => {
  const wrap = (content: string) => ({
    output: [{ type: 'message', content: [{ type: 'output_text', text: content }] }],
  })

  it('parsea issues y mapea frameIndex → approxSecond', () => {
    const json = wrap(JSON.stringify({
      issues: [{ text: 'exelente', problem: 'falta la c: «excelente»', frameIndex: 1 }],
      videoTopic: 'Promo de uniformes',
      clientMatchStatus: 'match',
      clientMatchReason: 'Se ve claramente la marca del cliente.',
      clientMatchEvidence: ['Logo Acme visible'],
    }))
    const out = parseSceneCheckResponse(json, frames)
    expect(out).toEqual({
      issues: [{ text: 'exelente', problem: 'falta la c: «excelente»', approxSecond: 10 }],
      videoTopic: 'Promo de uniformes',
      clientMatch: {
        status: 'match',
        reason: 'Se ve claramente la marca del cliente.',
        evidence: ['Logo Acme visible'],
      },
    })
  })

  it('frameIndex fuera de rango o ausente → approxSecond null', () => {
    const json = wrap(JSON.stringify({
      issues: [{ text: 'x', problem: 'y', frameIndex: 99 }],
      videoTopic: null,
      clientMatchStatus: 'uncertain',
      clientMatchReason: 'No hay evidencia suficiente.',
      clientMatchEvidence: [],
    }))
    expect(parseSceneCheckResponse(json, frames)!.issues[0].approxSecond).toBeNull()
  })

  it('sin issues → lista vacía', () => {
    const json = wrap(JSON.stringify({
      issues: [],
      videoTopic: 'algo',
      clientMatchStatus: 'mismatch',
      clientMatchReason: 'Aparece otra empresa.',
      clientMatchEvidence: ['Logo Beta visible'],
    }))
    expect(parseSceneCheckResponse(json, frames)).toEqual({
      issues: [],
      videoTopic: 'algo',
      clientMatch: {
        status: 'mismatch',
        reason: 'Aparece otra empresa.',
        evidence: ['Logo Beta visible'],
      },
    })
  })

  it('content con texto alrededor del JSON (```json ... ```) igual parsea', () => {
    const json = wrap('```json\n{"issues":[],"videoTopic":"t","clientMatchStatus":"uncertain","clientMatchReason":"No basta","clientMatchEvidence":[]}\n```')
    expect(parseSceneCheckResponse(json, frames)?.clientMatch.status).toBe('uncertain')
  })

  it('respuesta sin JSON válido → null', () => {
    expect(parseSceneCheckResponse(wrap('no hay nada'), frames)).toBeNull()
  })

  it('respuesta vacía / shape inesperado → null', () => {
    expect(parseSceneCheckResponse({}, frames)).toBeNull()
    expect(parseSceneCheckResponse(null, frames)).toBeNull()
  })

  it('issues con campos no-string se descartan', () => {
    const json = wrap(JSON.stringify({
      issues: [{ text: 5, problem: null }],
      videoTopic: null,
      clientMatchStatus: 'uncertain',
      clientMatchReason: 'Sin evidencia',
      clientMatchEvidence: [],
    }))
    expect(parseSceneCheckResponse(json, frames)?.issues).toEqual([])
  })

  it('rechaza un veredicto de cliente fuera del contrato', () => {
    const json = wrap(JSON.stringify({
      issues: [],
      videoTopic: 'algo',
      clientMatchStatus: 'definitely',
      clientMatchReason: 'Inventado',
      clientMatchEvidence: [],
    }))
    expect(parseSceneCheckResponse(json, frames)).toBeNull()
  })
})
