import { describe, it, expect } from 'vitest'
import {
  isoWeekday,
  nextCadencePost,
  spanishDateLabel,
  relativeDayLabel,
  platformLabels,
  humanJoinEs,
  buildNextAutopostFacts,
  deterministicNotice,
  buildNextAutopostPrompt,
} from './next-autopost-core'

describe('isoWeekday', () => {
  it('maps known dates (1=Mon..7=Sun)', () => {
    expect(isoWeekday('2024-01-01')).toBe(1) // Monday
    expect(isoWeekday('2024-01-05')).toBe(5) // Friday
    expect(isoWeekday('2024-01-07')).toBe(7) // Sunday
  })
})

describe('nextCadencePost', () => {
  it('finds the soonest future cadence day', () => {
    // today = Mon 2024-01-01; cadence = Friday(5) Reel → next is Fri 2024-01-05
    const r = nextCadencePost([{ day_of_week: 5, content_type: 'R' }], '2024-01-01')
    expect(r).toEqual({ dateISO: '2024-01-05', isoWeekday: 5, types: ['R'], daysFromToday: 4 })
  })
  it('includes today when today is a cadence day', () => {
    // today Mon 2024-01-01, cadence Monday(1)
    const r = nextCadencePost([{ day_of_week: 1, content_type: 'P' }], '2024-01-01')
    expect(r?.dateISO).toBe('2024-01-01')
    expect(r?.daysFromToday).toBe(0)
  })
  it('returns both types Reel-first when a day has R and P', () => {
    const r = nextCadencePost(
      [
        { day_of_week: 1, content_type: 'P' },
        { day_of_week: 1, content_type: 'R' },
      ],
      '2024-01-01',
    )
    expect(r?.types).toEqual(['R', 'P'])
  })
  it('picks the closest of several cadence days', () => {
    const r = nextCadencePost(
      [
        { day_of_week: 3, content_type: 'R' }, // Wed → 2024-01-03
        { day_of_week: 6, content_type: 'P' }, // Sat → 2024-01-06
      ],
      '2024-01-01',
    )
    expect(r?.dateISO).toBe('2024-01-03')
    expect(r?.types).toEqual(['R'])
  })
  it('returns null with no usable cadence', () => {
    expect(nextCadencePost([], '2024-01-01')).toBeNull()
    expect(nextCadencePost(null, '2024-01-01')).toBeNull()
    expect(nextCadencePost([{ day_of_week: 9, content_type: 'R' }], '2024-01-01')).toBeNull()
  })
})

describe('spanishDateLabel', () => {
  it('formats lowercase weekday + day + month', () => {
    expect(spanishDateLabel('2024-01-05')).toBe('viernes 5 de enero')
    expect(spanishDateLabel('2026-06-20')).toBe('sábado 20 de junio')
  })
})

describe('relativeDayLabel', () => {
  it('returns hoy / mañana / null', () => {
    expect(relativeDayLabel('2024-01-01', '2024-01-01')).toBe('hoy')
    expect(relativeDayLabel('2024-01-02', '2024-01-01')).toBe('mañana')
    expect(relativeDayLabel('2024-01-05', '2024-01-01')).toBeNull()
  })
})

describe('platformLabels', () => {
  it('prettifies known networks and capitalizes unknowns', () => {
    expect(platformLabels(['instagram', 'facebook', 'tiktok'])).toEqual(['Instagram', 'Facebook', 'TikTok'])
    expect(platformLabels(['mastodon'])).toEqual(['Mastodon'])
  })
})

describe('humanJoinEs', () => {
  it('joins with commas and a Spanish y', () => {
    expect(humanJoinEs(['Instagram'])).toBe('Instagram')
    expect(humanJoinEs(['Instagram', 'Facebook'])).toBe('Instagram y Facebook')
    expect(humanJoinEs(['Instagram', 'Facebook', 'TikTok'])).toBe('Instagram, Facebook y TikTok')
    expect(humanJoinEs([])).toBe('')
  })
})

describe('buildNextAutopostFacts + deterministicNotice', () => {
  const next = nextCadencePost([{ day_of_week: 5, content_type: 'R' }], '2024-01-01')!
  const facts = buildNextAutopostFacts('La Placita Café', next, ['instagram', 'facebook'], '2024-01-01')

  it('assembles display facts', () => {
    expect(facts).toEqual({
      clientName: 'La Placita Café',
      dateISO: '2024-01-05',
      dateLabel: 'viernes 5 de enero',
      relative: null,
      typeLabels: ['Reel'],
      platformLabels: ['Instagram', 'Facebook'],
    })
  })

  it('renders a deterministic notice with client, type, date and platforms', () => {
    const n = deterministicNotice(facts)
    expect(n).toContain('La Placita Café')
    expect(n).toContain('Reel')
    expect(n).toContain('viernes 5 de enero')
    expect(n).toContain('Instagram y Facebook')
    expect(n.startsWith('📅')).toBe(true)
  })

  it('uses hoy/mañana when relative', () => {
    const todayNext = nextCadencePost([{ day_of_week: 1, content_type: 'P' }], '2024-01-01')!
    const f2 = buildNextAutopostFacts('Cliente X', todayNext, ['tiktok'], '2024-01-01')
    expect(deterministicNotice(f2)).toContain('hoy')
  })

  it('prompt embeds the facts and asks for one sentence', () => {
    const p = buildNextAutopostPrompt(facts)
    expect(p).toContain('La Placita Café')
    expect(p).toContain('Instagram y Facebook')
    expect(p).toContain('UNA sola oración')
  })
})
