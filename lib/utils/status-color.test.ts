import { describe, it, expect } from 'vitest'
import { statusClasses, statusBadge, type StatusTone } from './status-color'

describe('status-color', () => {
  it('maps each tone to badge/text/dot classes built on tokens', () => {
    expect(statusClasses('success').text).toBe('text-success')
    expect(statusClasses('warning').dot).toBe('bg-warning')
    expect(statusClasses('info').badge).toContain('bg-info/10')
    expect(statusClasses('danger').text).toBe('text-destructive')
    expect(statusClasses('neutral').text).toBe('text-muted-foreground')
  })

  it('never falls back to a hardcoded raw color palette', () => {
    const tones: StatusTone[] = ['success', 'warning', 'danger', 'info', 'neutral']
    for (const t of tones) {
      const { badge, text, dot } = statusClasses(t)
      for (const cls of [badge, text, dot]) {
        // no raw tailwind palette colors like bg-green-500 / text-red-600
        expect(cls).not.toMatch(/(red|green|blue|yellow|orange|emerald|amber|sky)-\d{3}/)
      }
    }
  })

  it('statusBadge is shorthand for the badge classes', () => {
    expect(statusBadge('success')).toBe(statusClasses('success').badge)
  })

  it('falls back to neutral for an unknown tone', () => {
    expect(statusClasses('bogus' as StatusTone)).toEqual(statusClasses('neutral'))
  })
})
