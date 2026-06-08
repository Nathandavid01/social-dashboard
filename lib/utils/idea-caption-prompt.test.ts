import { describe, it, expect } from 'vitest'
import { buildIdeaCaptionPrompt } from './idea-caption-prompt'

describe('buildIdeaCaptionPrompt', () => {
  const base = { title: 'Cómo limpiar tu sofá', examples: [] }

  it('always includes the video title', () => {
    expect(buildIdeaCaptionPrompt(base)).toContain('Cómo limpiar tu sofá')
  })

  it('injects brand voice + language constraints when present', () => {
    const p = buildIdeaCaptionPrompt({
      ...base,
      client: { name: 'Restauco', brandVoice: 'cercana y experta', captionLanguage: 'español' },
    })
    expect(p).toContain('Voz de marca: cercana y experta')
    expect(p).toMatch(/Idioma: español/)
    expect(p).toContain('Restauco')
  })

  it('embeds reference captions and instructs the model to imitate them', () => {
    const p = buildIdeaCaptionPrompt({
      ...base,
      examples: [
        { text: 'Tu sofá como nuevo ✨ #restauración', provider: 'instagram' },
        { text: 'Antes y después 🔥', provider: 'tiktok' },
      ],
    })
    expect(p).toContain('CAPTIONS DE REFERENCIA')
    expect(p).toContain('Tu sofá como nuevo ✨ #restauración')
    expect(p).toContain('Antes y después 🔥')
    expect(p).toMatch(/Ejemplo 1 \(instagram\)/)
    expect(p).toMatch(/Ejemplo 2 \(tiktok\)/)
    expect(p).toMatch(/imita.*estilo/i)
  })

  it('falls back to a natural-style instruction when there are no examples', () => {
    const p = buildIdeaCaptionPrompt(base)
    expect(p).toContain('No hay captions previos de este cliente')
    expect(p).not.toContain('CAPTIONS DE REFERENCIA')
  })

  it('includes the hook only when provided', () => {
    expect(buildIdeaCaptionPrompt({ ...base, hook: 'Gancho fuerte' })).toContain('- Hook: Gancho fuerte')
    expect(buildIdeaCaptionPrompt(base)).not.toContain('- Hook:')
  })

  // Caption único: a single caption for ALL the client's networks (no per-platform selection).
  it('lists the client networks and asks for a single caption that works for all of them', () => {
    const p = buildIdeaCaptionPrompt({ ...base, platforms: ['instagram', 'tiktok', 'facebook'] })
    expect(p).toContain('instagram, tiktok, facebook')
    expect(p).toMatch(/un solo caption/i)
    expect(p).not.toContain('PLATAFORMA:')
  })

  it('uses generic all-networks wording when no platforms are given', () => {
    const p = buildIdeaCaptionPrompt(base)
    expect(p).toMatch(/todas las redes/i)
    expect(p).toMatch(/un solo caption/i)
    // never emit a dangling REDES line with no networks
    expect(p).not.toMatch(/REDES:\s*\n/)
  })

  it('ignores empty/blank platform entries', () => {
    const p = buildIdeaCaptionPrompt({ ...base, platforms: ['', '  '] })
    expect(p).toMatch(/todas las redes/i)
    expect(p).not.toMatch(/REDES:\s*\n/)
  })
})
