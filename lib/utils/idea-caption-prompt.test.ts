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

  it('includes the visual brief when provided', () => {
    const p = buildIdeaCaptionPrompt({ ...base, hook: 'Gancho', visualBrief: 'Grabar en la cocina' })
    expect(p).toContain('- Brief visual (qué grabar): Grabar en la cocina')
    expect(p).toMatch(/alinearse con el hook y el brief visual/i)
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

  it('injects user feedback + the previous caption when revising', () => {
    const p = buildIdeaCaptionPrompt({
      ...base,
      feedback: 'Más corto y sin emojis',
      previousCaption: 'Caption viejo largo ✨✨✨',
    })
    expect(p).toContain('FEEDBACK DEL EQUIPO')
    expect(p).toContain('Más corto y sin emojis')
    expect(p).toContain('CAPTION ANTERIOR')
    expect(p).toContain('Caption viejo largo ✨✨✨')
    expect(p).toMatch(/Aplica el FEEDBACK DEL EQUIPO/)
  })

  it('omits the feedback block entirely when no feedback is given', () => {
    const p = buildIdeaCaptionPrompt(base)
    expect(p).not.toContain('FEEDBACK DEL EQUIPO')
    expect(p).not.toContain('CAPTION ANTERIOR')
  })

  it('includes feedback even without a previous caption (no CAPTION ANTERIOR section)', () => {
    const p = buildIdeaCaptionPrompt({ ...base, feedback: 'Más llamado a la acción' })
    expect(p).toContain('Más llamado a la acción')
    expect(p).not.toContain('CAPTION ANTERIOR')
  })

  it('injects the team-approved captions as the standard to match (learning loop)', () => {
    const p = buildIdeaCaptionPrompt({
      ...base,
      approvedExamples: ['Caption aprobado uno con largo suficiente', 'Caption aprobado dos con largo suficiente'],
    })
    expect(p).toContain('CAPTIONS QUE EL EQUIPO YA APROBÓ PARA ESTE CLIENTE')
    expect(p).toContain('Caption aprobado uno con largo suficiente')
    expect(p).toContain('Caption aprobado dos con largo suficiente')
    expect(p).toMatch(/MÁXIMA prioridad/)
  })

  it('omits the approved block when there are none', () => {
    const p = buildIdeaCaptionPrompt(base)
    expect(p).not.toContain('CAPTIONS QUE EL EQUIPO YA APROBÓ')
  })
})
