import { describe, it, expect } from 'vitest'
import {
  selectTopPosts,
  formatWinnersForPrompt,
  formatFeedbackForPrompt,
  buildGenerationPrompt,
  buildCritiquePrompt,
  type PerfPost,
  type IdeaGenInput,
} from './idea-prompt'

const baseInput: IdeaGenInput = {
  count: 5,
  general: false,
  clientName: "Joe's Gym",
  industry: 'Fitness',
  clientProfile: 'Brand voice: motivational',
  theme: undefined,
  trends: [],
  typeLabels: ['Reel', 'Static Post'],
  winners: [],
  recentTexts: [],
}

describe('selectTopPosts', () => {
  const posts: PerfPost[] = [
    { text: 'Low performer with enough length to count here', likes: 2, comments: 0 },
    { text: 'Viral one — long enough to be considered seriously', likes: 500, comments: 40, shares: 10 },
    { text: 'Mid post that also has sufficient length to qualify', engagement: 120 },
    { text: 'too short', likes: 9999 }, // filtered: text < 20 chars
  ]

  it('ranks by engagement and returns at most n, skipping trivial copy', () => {
    const top = selectTopPosts(posts, 2)
    expect(top).toHaveLength(2)
    expect(top[0].text).toContain('Viral one')
    expect(top[1].text).toContain('Mid post')
  })

  it('falls back to reach when no interactions are present', () => {
    const top = selectTopPosts(
      [{ text: 'Reach-only post that is long enough to qualify', reach: 800 }],
      5
    )
    expect(top[0].score).toBe(800)
  })

  it('returns [] for non-array input', () => {
    // @ts-expect-error runtime guard
    expect(selectTopPosts(null, 5)).toEqual([])
  })
})

describe('formatWinnersForPrompt', () => {
  it('lists winners with engagement counts and a "study why" framing', () => {
    const block = formatWinnersForPrompt([{ text: 'Great post', score: 100, likes: 90, comments: 10 }])
    expect(block).toContain('TOP-PERFORMING')
    expect(block).toContain('Great post')
    expect(block).toContain('❤ 90')
    expect(block).toContain('💬 10')
  })

  it('returns empty string when there are no winners', () => {
    expect(formatWinnersForPrompt([])).toBe('')
  })
})

describe('buildGenerationPrompt', () => {
  it('always includes the marketing playbook and the Puerto Rican cultural lens', () => {
    const p = buildGenerationPrompt(baseInput)
    expect(p).toContain('MARKETING PLAYBOOK')
    expect(p).toContain('PUERTO RICAN CULTURAL LENS')
    expect(p).toContain('"objective"')
    expect(p).toContain('"funnel_stage"')
  })

  it('embeds top-performing winners when provided', () => {
    const p = buildGenerationPrompt({
      ...baseInput,
      winners: [{ text: 'Our best reel ever', score: 300, likes: 280, comments: 20 }],
    })
    expect(p).toContain('Our best reel ever')
    expect(p).toContain('TOP-PERFORMING')
  })

  it('embeds every selected trend', () => {
    const p = buildGenerationPrompt({ ...baseInput, trends: ['Bad Bunny', 'verano'] })
    expect(p).toContain('Bad Bunny')
    expect(p).toContain('verano')
    expect(p).toContain('TRENDS TO RIDE')
  })

  it('switches to general brainstorming wording when no client', () => {
    const p = buildGenerationPrompt({ ...baseInput, general: true, clientName: undefined })
    expect(p).toContain('General marketing brainstorming')
    expect(p).not.toContain('CLIENT:')
  })
})

describe('formatFeedbackForPrompt (learning loop)', () => {
  it('renders approved and rejected sections with the right steer', () => {
    const block = formatFeedbackForPrompt(['Reto de 30 días'], ['Frase motivacional genérica'])
    expect(block).toContain('APPROVED')
    expect(block).toContain('Reto de 30 días')
    expect(block).toContain('REJECTED')
    expect(block).toContain('Frase motivacional genérica')
  })

  it('returns empty string when there is no feedback yet', () => {
    expect(formatFeedbackForPrompt([], [])).toBe('')
  })

  it('includes only the section that has data', () => {
    expect(formatFeedbackForPrompt(['Good one'], [])).toContain('APPROVED')
    expect(formatFeedbackForPrompt(['Good one'], [])).not.toContain('REJECTED')
  })
})

describe('buildGenerationPrompt — learning loop', () => {
  it('embeds approved and rejected examples when present', () => {
    const p = buildGenerationPrompt({
      ...baseInput,
      approvedExamples: ['Reto de 30 días'],
      rejectedExamples: ['Frase genérica'],
    })
    expect(p).toContain('Reto de 30 días')
    expect(p).toContain('Frase genérica')
    expect(p).toContain('APPROVED')
  })
})

describe('buildCritiquePrompt', () => {
  it('feeds the first draft back and asks for a sharper rewrite in the same schema', () => {
    const c = buildCritiquePrompt('[{"title":"x"}]', baseInput)
    expect(c).toContain('[{"title":"x"}]')
    expect(c).toContain('SKEPTICAL')
    expect(c).toContain('"funnel_stage"')
  })
})
