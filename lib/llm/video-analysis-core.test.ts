import { describe, it, expect } from 'vitest'
import {
  GROK_VISION_MODEL, videoAnalysisModelId, videoAnalysisConfigError,
  buildVideoAnalysisPrompt, buildVideoAnalysisRequest, parseVideoAnalysisResponse,
} from './video-analysis-core'

describe('videoAnalysisModelId', () => {
  it('default grok-4.6, override por env', () => {
    expect(videoAnalysisModelId({})).toBe('grok-4.6')
    expect(GROK_VISION_MODEL).toBe('grok-4.6')
    expect(videoAnalysisModelId({ GROK_VISION_MODEL: 'grok-4.5' })).toBe('grok-4.5')
    expect(videoAnalysisModelId({ GROK_VISION_MODEL: '  ' })).toBe('grok-4.6')
  })
})

describe('videoAnalysisConfigError', () => {
  it('falta XAI_API_KEY → mensaje; presente → null', () => {
    expect(videoAnalysisConfigError({})).toMatch(/XAI_API_KEY/)
    expect(videoAnalysisConfigError({ XAI_API_KEY: 'k' })).toBeNull()
  })
})

describe('buildVideoAnalysisPrompt', () => {
  it('incluye cliente, idea y la regla de no corregir el español de PR', () => {
    const p = buildVideoAnalysisPrompt({
      ideaTitle: 'Promo agosto', hook: 'Descuentazo', clientName: 'Dental Pro',
      brandVoice: 'cercano, jerga boricua', captionLanguage: 'español', captionNotes: 'nunca usar usted',
    })
    expect(p).toContain('Dental Pro')
    expect(p).toContain('Promo agosto')
    expect(p).toContain('jerga boricua')
    expect(p.toLowerCase()).toContain('puertorriqueño')
    expect(p).toContain('JSON')
    expect(p.toLowerCase()).toContain('cronológico')
    expect(p.toLowerCase()).toMatch(/cada fotograma/)
  })
  it('sin cliente ni hook no revienta', () => {
    const p = buildVideoAnalysisPrompt({ ideaTitle: 'X' })
    expect(p).toContain('X')
  })
})

describe('buildVideoAnalysisRequest', () => {
  it('arma mensaje multimodal con texto + un image_url por frame (sin timestamps)', () => {
    const req = buildVideoAnalysisRequest({
      frames: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
      prompt: 'analiza', apiKey: 'k', model: 'grok-4.6',
    })
    expect(req.url).toBe('https://api.x.ai/v1/chat/completions')
    expect(req.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(req.body)
    expect(body.model).toBe('grok-4.6')
    expect(body.max_tokens).toBe(4096)
    const content = body.messages[0].content
    expect(content[0]).toEqual({ type: 'text', text: 'analiza' })
    expect(content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } })
    expect(content).toHaveLength(3)
  })

  it('con timestamps: intercala una etiqueta de texto antes de cada imagen', () => {
    const req = buildVideoAnalysisRequest({
      frames: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
      timestamps: [0.3, 1.8],
      prompt: 'analiza', apiKey: 'k', model: 'grok-4.6',
    })
    const content = JSON.parse(req.body).messages[0].content
    expect(content).toEqual([
      { type: 'text', text: 'analiza' },
      { type: 'text', text: '--- Fotograma 1 · t=0.3s ---' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } },
      { type: 'text', text: '--- Fotograma 2 · t=1.8s ---' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } },
    ])
  })

  it('timestamps de longitud distinta a frames: cae al comportamiento sin timestamps', () => {
    const req = buildVideoAnalysisRequest({
      frames: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
      timestamps: [0.3],
      prompt: 'analiza', apiKey: 'k', model: 'grok-4.6',
    })
    const content = JSON.parse(req.body).messages[0].content
    expect(content).toEqual([
      { type: 'text', text: 'analiza' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } },
    ])
  })
})

describe('parseVideoAnalysisResponse', () => {
  const wrap = (content: string) => ({ choices: [{ message: { content } }] })
  const good = {
    burned_captions: { text: 'Ven hoy', issues: [{ quote: 'aserca', problem: 'ortografía', suggestion: 'acerca' }] },
    relevance: { verdict: 'ok', explanation: 'habla del cliente' },
    visual_summary: 'doctora hablando a cámara',
  }
  it('parsea JSON limpio', () => {
    expect(parseVideoAnalysisResponse(wrap(JSON.stringify(good)))).toEqual(good)
  })
  it('tolera fences ```json', () => {
    expect(parseVideoAnalysisResponse(wrap('```json\n' + JSON.stringify(good) + '\n```'))).toEqual(good)
  })
  it('normaliza campos faltantes (sin issues, sin verdict)', () => {
    const partial = wrap(JSON.stringify({ visual_summary: 'algo' }))
    const out = parseVideoAnalysisResponse(partial)
    expect(out).toEqual({
      burned_captions: { text: '', issues: [] },
      relevance: { verdict: 'warning', explanation: '' },
      visual_summary: 'algo',
    })
  })
  it('verdict desconocido → warning; respuesta rota → null', () => {
    const weird = wrap(JSON.stringify({ ...good, relevance: { verdict: 'meh', explanation: 'x' } }))
    expect(parseVideoAnalysisResponse(weird)?.relevance.verdict).toBe('warning')
    expect(parseVideoAnalysisResponse(wrap('no es json'))).toBeNull()
    expect(parseVideoAnalysisResponse(null)).toBeNull()
    expect(parseVideoAnalysisResponse({})).toBeNull()
  })

  it('issues[].t: se conserva cuando viene, se omite cuando no', () => {
    const withT = {
      ...good,
      burned_captions: {
        text: 'Ven hoy',
        issues: [{ quote: 'aserca', problem: 'ortografía', suggestion: 'acerca', t: '0.5s' }],
      },
    }
    const outWithT = parseVideoAnalysisResponse(wrap(JSON.stringify(withT)))
    expect(outWithT?.burned_captions.issues[0].t).toBe('0.5s')

    const outWithoutT = parseVideoAnalysisResponse(wrap(JSON.stringify(good)))
    expect(outWithoutT?.burned_captions.issues[0].t).toBeUndefined()
  })
})
