import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn(async () => ({ content: [{ type: 'text', text: 'CAPTION GENERADO ✨ #BlackFriday' }] }))
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create } } }))

const requirePermission = vi.fn(async (_p: string) => {})
vi.mock('@/lib/auth/server', () => ({ requirePermission: (p: string) => requirePermission(p) }))

let clientRow: Record<string, unknown> | null
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: clientRow, error: null }) }) }) }),
  }),
}))

import { generateCaptionDraft } from './caption-draft'

beforeEach(() => {
  create.mockClear().mockResolvedValue({ content: [{ type: 'text', text: 'CAPTION GENERADO ✨ #BlackFriday' }] })
  requirePermission.mockReset().mockResolvedValue(undefined)
  clientRow = { name: 'Bella Boutique', brand_voice: 'fresca y divertida', caption_language: 'es' }
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

describe('generateCaptionDraft', () => {
  it('returns an AI caption for the given title (without persisting)', async () => {
    const res = await generateCaptionDraft({ clientId: 'c1', title: 'Promo Black Friday' })
    expect(res.caption).toContain('CAPTION GENERADO')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('grounds the prompt in the title and client', async () => {
    await generateCaptionDraft({ clientId: 'c1', title: 'Promo Black Friday' })
    const prompt = JSON.stringify((create.mock.calls as unknown as any[][])[0][0])
    expect(prompt).toContain('Promo Black Friday')
    expect(prompt).toContain('Bella Boutique')
  })

  it('rejects an empty title and does not call the AI', async () => {
    const res = await generateCaptionDraft({ clientId: 'c1', title: '   ' })
    expect(res.error).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })

  it('errors when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await generateCaptionDraft({ clientId: 'c1', title: 'Promo' })
    expect(res.error).toMatch(/ANTHROPIC_API_KEY/)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns an error when the user lacks captions.use', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await generateCaptionDraft({ clientId: 'c1', title: 'Promo' })
    expect(res.error).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })
})
