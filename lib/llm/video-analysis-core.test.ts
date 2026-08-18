import { describe, it, expect } from 'vitest'
import {
  GROK_VISION_MODEL, videoAnalysisModelId, videoAnalysisConfigError,
  buildVideoAnalysisPrompt, buildVideoAnalysisRequest, parseVideoAnalysisResponse,
  mergeVideoAnalysisFindings, filterSceneCutCaptionIssues, parseIssueSeconds,
  type VideoAnalysisFindings,
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
    expect(p).toContain('confidence')
    expect(p.toLowerCase()).toContain('cronológico')
    expect(p.toLowerCase()).toMatch(/cada fotograma/)
  })
  it('sin cliente ni hook no revienta', () => {
    const p = buildVideoAnalysisPrompt({ ideaTitle: 'X' })
    expect(p).toContain('X')
  })
  it('pide video_topic con la definición correcta: una frase factual "de qué es", distinta de visual_summary', () => {
    const p = buildVideoAnalysisPrompt({ ideaTitle: 'Promo agosto' })
    expect(p).toContain('"video_topic"')
    // Debe explicar que es UNA frase para explicarle a un copywriter de qué va
    // el video, no el resumen visual técnico ni marketing.
    expect(p.toLowerCase()).toMatch(/de qué (es|va) el video/)
    expect(p.toLowerCase()).toMatch(/copywriter/)
    // El JSON de salida trae ambos campos, claramente distintos.
    expect(p).toContain('"visual_summary"')
  })

  it('sin transcripción: no inyecta el bloque de transcripción', () => {
    const p = buildVideoAnalysisPrompt({ ideaTitle: 'Promo agosto' })
    expect(p).not.toMatch(/TRANSCRIPCIÓN DEL AUDIO \(lo que se DICE/)
  })

  it('con transcripción: la incluye en el prompt y explica que lo que se dice manda sobre lo que se ve', () => {
    const p = buildVideoAnalysisPrompt({
      ideaTitle: 'Promo agosto',
      transcript: 'Hoy les traigo la mejor picanha con roble rojo, vengan antes de las 6pm',
    })
    expect(p).toContain('Hoy les traigo la mejor picanha con roble rojo, vengan antes de las 6pm')
    expect(p.toLowerCase()).toMatch(/lo que se dice manda sobre lo que se (intuye|ve)/)
  })

  it('video_topic combina ver + oír: la instrucción menciona ambas fuentes', () => {
    const p = buildVideoAnalysisPrompt({ ideaTitle: 'Promo agosto' })
    expect(p.toLowerCase()).toMatch(/se ve/)
    expect(p.toLowerCase()).toMatch(/se dice/)
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

  it('video_topic: se conserva cuando viene', () => {
    const withTopic = { ...good, video_topic: 'Cómo sellar una picanha en parrilla Santa María con roble rojo' }
    const out = parseVideoAnalysisResponse(wrap(JSON.stringify(withTopic)))
    expect(out?.video_topic).toBe('Cómo sellar una picanha en parrilla Santa María con roble rojo')
  })

  it('video_topic ausente o de tipo raro: undefined, nunca revienta', () => {
    expect(parseVideoAnalysisResponse(wrap(JSON.stringify(good)))?.video_topic).toBeUndefined()
    const weirdType = wrap(JSON.stringify({ ...good, video_topic: 42 }))
    expect(parseVideoAnalysisResponse(weirdType)?.video_topic).toBeUndefined()
  })

  it('relevance.confidence: 0–100; si falta, undefined (el UI usa fallback)', () => {
    const withConf = wrap(JSON.stringify({
      ...good,
      relevance: { verdict: 'ok', confidence: 87, explanation: 'coincide' },
    }))
    expect(parseVideoAnalysisResponse(withConf)?.relevance.confidence).toBe(87)

    const clamped = wrap(JSON.stringify({
      ...good,
      relevance: { verdict: 'ok', confidence: 140, explanation: 'x' },
    }))
    expect(parseVideoAnalysisResponse(clamped)?.relevance.confidence).toBe(100)

    expect(parseVideoAnalysisResponse(wrap(JSON.stringify(good)))?.relevance.confidence).toBeUndefined()
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

describe('mergeVideoAnalysisFindings', () => {
  const findings = (over: Partial<VideoAnalysisFindings> = {}): VideoAnalysisFindings => ({
    burned_captions: { text: '', issues: [] },
    relevance: { verdict: 'ok', explanation: '' },
    visual_summary: '',
    ...over,
  })

  it('concatena burned_captions.text sin repetir texto idéntico', () => {
    const a = findings({ burned_captions: { text: 'Ven hoy', issues: [] } })
    const b = findings({ burned_captions: { text: 'al gym', issues: [] } })
    expect(mergeVideoAnalysisFindings(a, b).burned_captions.text).toBe('Ven hoy al gym')
  })

  it('no duplica el texto si el chunk repite exactamente lo mismo', () => {
    const a = findings({ burned_captions: { text: 'Ven hoy', issues: [] } })
    const b = findings({ burned_captions: { text: 'Ven hoy', issues: [] } })
    expect(mergeVideoAnalysisFindings(a, b).burned_captions.text).toBe('Ven hoy')
  })

  it('une issues deduplicando por quote+t', () => {
    const a = findings({
      burned_captions: { text: '', issues: [{ quote: 'aserca', problem: 'p', suggestion: 's', t: '0.3s' }] },
    })
    const b = findings({
      burned_captions: {
        text: '',
        issues: [
          { quote: 'aserca', problem: 'p', suggestion: 's', t: '0.3s' }, // mismo quote+t → no se duplica
          { quote: 'aserca', problem: 'p', suggestion: 's', t: '8.1s' }, // mismo quote, distinto t → se conserva
          { quote: 'nuevo error', problem: 'p2', suggestion: 's2' },
        ],
      },
    })
    const merged = mergeVideoAnalysisFindings(a, b)
    expect(merged.burned_captions.issues).toHaveLength(3)
    expect(merged.burned_captions.issues.map((i) => `${i.quote}|${i.t ?? ''}`)).toEqual([
      'aserca|0.3s', 'aserca|8.1s', 'nuevo error|',
    ])
  })

  it('relevance: warning manda sobre ok, sin importar el orden', () => {
    const ok = findings({ relevance: { verdict: 'ok', explanation: 'coincide' } })
    const warn = findings({ relevance: { verdict: 'warning', explanation: 'no coincide' } })
    expect(mergeVideoAnalysisFindings(ok, warn).relevance).toMatchObject({ verdict: 'warning', explanation: 'no coincide' })
    expect(mergeVideoAnalysisFindings(warn, ok).relevance).toMatchObject({ verdict: 'warning', explanation: 'no coincide' })
    expect(mergeVideoAnalysisFindings(ok, ok).relevance.verdict).toBe('ok')
  })

  it('visual_summary: conserva el primero no vacío y añade lo nuevo si aporta', () => {
    const a = findings({ visual_summary: 'persona cocina picanha en parrilla' })
    const b = findings({ visual_summary: 'cierra con el logo de Arasibo' })
    expect(mergeVideoAnalysisFindings(a, b).visual_summary).toBe('persona cocina picanha en parrilla cierra con el logo de Arasibo')
  })

  it('visual_summary: si el segundo está vacío, se queda con el primero', () => {
    const a = findings({ visual_summary: 'algo' })
    const b = findings({ visual_summary: '' })
    expect(mergeVideoAnalysisFindings(a, b).visual_summary).toBe('algo')
  })

  it('visual_summary: si el primero está vacío, usa el segundo', () => {
    const a = findings({ visual_summary: '' })
    const b = findings({ visual_summary: 'algo' })
    expect(mergeVideoAnalysisFindings(a, b).visual_summary).toBe('algo')
  })

  it('tolera a nulo (chunk 0 falló, llega el chunk 1): el resultado es b', () => {
    const b = findings({ visual_summary: 'solo esto' })
    expect(mergeVideoAnalysisFindings(null, b)).toEqual(b)
  })

  it('campos vacíos en ambos lados no revientan', () => {
    expect(mergeVideoAnalysisFindings(findings(), findings())).toMatchObject({
      burned_captions: { text: '', issues: [] },
      relevance: { verdict: 'ok', explanation: '' },
      visual_summary: '',
    })
  })

  it('video_topic: conserva el primero no vacío', () => {
    const a = findings({ video_topic: 'Cómo sellar picanha' })
    const b = findings({ video_topic: 'otra cosa' })
    expect(mergeVideoAnalysisFindings(a, b).video_topic).toBe('Cómo sellar picanha')
  })

  it('video_topic: si el primer chunk no lo trajo, usa el del segundo', () => {
    const a = findings({ video_topic: undefined })
    const b = findings({ video_topic: 'Cómo sellar picanha' })
    expect(mergeVideoAnalysisFindings(a, b).video_topic).toBe('Cómo sellar picanha')
  })

  it('video_topic: ninguno lo trajo → undefined', () => {
    expect(mergeVideoAnalysisFindings(findings(), findings()).video_topic).toBeUndefined()
  })
})

describe('buildVideoAnalysisPrompt — no inventar letras en el corte de escena', () => {
  it('prohíbe marcar como error una letra que solo se ve a medias al cambiar de pantalla', () => {
    const p = buildVideoAnalysisPrompt({ ideaTitle: 'Promo agosto' }).toLowerCase()
    expect(p).toMatch(/cambio de (escena|pantalla)|corte/)
    expect(p).toMatch(/letra/)
    expect(p).toMatch(/completa|formad|legible/)
  })
})

describe('buildVideoAnalysisRequest — etiqueta CORTE', () => {
  it('marca · CORTE en los fotogramas cuyo timestamp está en cuts', () => {
    const req = buildVideoAnalysisRequest({
      frames: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
      timestamps: [0.3, 1.8],
      cuts: [1.8],
      prompt: 'analiza', apiKey: 'k', model: 'grok-4.6',
    })
    const content = JSON.parse(req.body).messages[0].content
    expect(content).toContainEqual({ type: 'text', text: '--- Fotograma 1 · t=0.3s ---' })
    expect(content).toContainEqual({ type: 'text', text: '--- Fotograma 2 · t=1.8s · CORTE ---' })
  })
})

describe('parseIssueSeconds', () => {
  it('lee "5.75s", "5.75" y rechaza basura', () => {
    expect(parseIssueSeconds('5.75s')).toBe(5.75)
    expect(parseIssueSeconds('0.3s')).toBe(0.3)
    expect(parseIssueSeconds('8')).toBe(8)
    expect(parseIssueSeconds(undefined)).toBeNull()
    expect(parseIssueSeconds('foo')).toBeNull()
  })
})

describe('filterSceneCutCaptionIssues', () => {
  const issue = (quote: string, t: string | undefined, problem = 'ortografía') => ({
    quote, problem, suggestion: quote, ...(t ? { t } : {}),
  })

  it('sin cortes: no toca nada', () => {
    const issues = [issue('plza', '5.5s', 'falta una letra')]
    expect(filterSceneCutCaptionIssues(issues, [])).toEqual(issues)
  })

  it('tira el falso positivo de una letra que solo aparece en el corte', () => {
    const issues = [issue('plza', '5.5s', 'falta una letra')]
    expect(filterSceneCutCaptionIssues(issues, [5.5])).toEqual([])
  })

  it('conserva un typo real que también se reportó lejos del corte', () => {
    const issues = [
      issue('Santamaria', '5.5s'),
      issue('Santamaria', '8.0s'),
    ]
    const out = filterSceneCutCaptionIssues(issues, [5.5])
    expect(out).toHaveLength(2)
    expect(out.map((i) => i.t)).toEqual(['5.5s', '8.0s'])
  })

  it('conserva un typo que no está cerca de ningún corte', () => {
    const issues = [issue('aserca', '2.0s')]
    expect(filterSceneCutCaptionIssues(issues, [5.5])).toEqual(issues)
  })

  it('issue sin t: se conserva (no podemos ubicarla)', () => {
    const issues = [issue('plza', undefined, 'falta una letra')]
    expect(filterSceneCutCaptionIssues(issues, [5.5])).toEqual(issues)
  })
})
