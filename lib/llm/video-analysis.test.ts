import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyzeVideoFrames } from './video-analysis'

const good = {
  burned_captions: { text: 'Ven hoy', issues: [] },
  relevance: { verdict: 'ok', explanation: 'coincide' },
  visual_summary: 'persona a cámara',
}
const okResponse = {
  ok: true,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(good) } }] }),
}

describe('analyzeVideoFrames', () => {
  beforeEach(() => { process.env.XAI_API_KEY = 'test-key' })
  afterEach(() => { vi.restoreAllMocks(); delete process.env.XAI_API_KEY })

  it('llama a Grok y devuelve findings parseados', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse as Response)
    const out = await analyzeVideoFrames(['data:image/jpeg;base64,A'], { ideaTitle: 'T' })
    expect(out).toEqual(good)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.x.ai/v1/chat/completions')
    expect(JSON.parse((init as RequestInit).body as string).model).toBe('grok-4.6')
  })

  it('pasa timestamps al builder cuando se proveen: quedan intercalados en el body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse as Response)
    await analyzeVideoFrames(['data:image/jpeg;base64,A'], { ideaTitle: 'T' }, [1.2])
    const [, init] = fetchMock.mock.calls[0]
    const content = JSON.parse((init as RequestInit).body as string).messages[0].content
    expect(content).toContainEqual({ type: 'text', text: '--- Fotograma 1 · t=1.2s ---' })
  })

  it('sin XAI_API_KEY → lanza con mensaje claro', async () => {
    delete process.env.XAI_API_KEY
    await expect(analyzeVideoFrames(['d'], { ideaTitle: 'T' })).rejects.toThrow(/XAI_API_KEY/)
  })

  it('HTTP no-ok → lanza con status; respuesta imparseable → lanza', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 429, text: async () => 'rate' } as Response)
    await expect(analyzeVideoFrames(['d'], { ideaTitle: 'T' })).rejects.toThrow(/429/)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'no json' } }] }) } as Response)
    await expect(analyzeVideoFrames(['d'], { ideaTitle: 'T' })).rejects.toThrow(/no devolvió/)
  })
})
