import { describe, it, expect } from 'vitest'
import { deadlineStatus, addDaysISO, todayISO, deadlineTone, worstDeadlineStatus } from './deadlines'

describe('todayISO', () => {
  it('uses local calendar parts (no UTC off-by-one near midnight)', () => {
    // 2026-06-08 23:30 local — toISOString() would roll to 06-09 in UTC for PR (UTC-4).
    const d = new Date(2026, 5, 8, 23, 30, 0)
    expect(todayISO(d)).toBe('2026-06-08')
  })
  it('zero-pads month and day', () => {
    expect(todayISO(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('addDaysISO', () => {
  it('adds days and rolls over months', () => {
    expect(addDaysISO('2026-06-08', 2)).toBe('2026-06-10')
    expect(addDaysISO('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('supports negative offsets', () => {
    expect(addDaysISO('2026-06-01', -1)).toBe('2026-05-31')
  })
})

describe('deadlineStatus', () => {
  const today = '2026-06-08'
  it("is 'none' when there is no deadline", () => {
    expect(deadlineStatus(null, 'grabada', today)).toBe('none')
    expect(deadlineStatus('', 'grabada', today)).toBe('none')
  })
  it("is 'none' when the video is already published, even if the deadline passed", () => {
    expect(deadlineStatus('2026-01-01', 'publicada', today)).toBe('none')
  })
  it("is 'none' when published_at is set even if status was not flipped to 'publicada'", () => {
    expect(deadlineStatus('2026-01-01', 'grabada', today, '2026-06-07T10:00:00Z')).toBe('none')
  })
  it("is 'overdue' when the deadline is before today and not published", () => {
    expect(deadlineStatus('2026-06-07', 'producida', today)).toBe('overdue')
  })
  it("is 'due-soon' for today and up to 2 days out", () => {
    expect(deadlineStatus('2026-06-08', 'idea', today)).toBe('due-soon')
    expect(deadlineStatus('2026-06-09', 'idea', today)).toBe('due-soon')
    expect(deadlineStatus('2026-06-10', 'idea', today)).toBe('due-soon')
  })
  it("is 'future' beyond the 2-day window", () => {
    expect(deadlineStatus('2026-06-11', 'idea', today)).toBe('future')
  })
})

describe('worstDeadlineStatus', () => {
  const today = '2026-06-08'
  it('returns "none" for an empty set', () => {
    expect(worstDeadlineStatus([], today)).toBe('none')
  })
  it('picks the most urgent across videos (overdue beats due-soon beats future)', () => {
    const vids = [
      { deadline: '2026-06-20', status: 'idea' }, // future
      { deadline: '2026-06-09', status: 'idea' }, // due-soon
      { deadline: '2026-06-01', status: 'grabada' }, // overdue
    ]
    expect(worstDeadlineStatus(vids, today)).toBe('overdue')
  })
  it('ignores published videos when picking the worst', () => {
    const vids = [
      { deadline: '2026-01-01', status: 'grabada', published_at: '2026-05-01' }, // published → ignored
      { deadline: '2026-06-09', status: 'idea' }, // due-soon
    ]
    expect(worstDeadlineStatus(vids, today)).toBe('due-soon')
  })
})

describe('deadlineTone', () => {
  it('maps overdue → red + Atrasado', () => {
    const t = deadlineTone('overdue')
    expect(t.label).toBe('Atrasado')
    expect(t.className).toMatch(/red/)
  })
  it('maps due-soon → amber + Pronto', () => {
    const t = deadlineTone('due-soon')
    expect(t.label).toBe('Pronto')
    expect(t.className).toMatch(/amber/)
  })
  it('maps future/none → null label', () => {
    expect(deadlineTone('future').label).toBeNull()
    expect(deadlineTone('none').label).toBeNull()
  })
})
