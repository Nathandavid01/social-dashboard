import { describe, it, expect } from 'vitest'
import { newestUnreadAt, shouldPulseBell, unreadCount } from './notification-bell'

const NOW = Date.parse('2026-08-18T12:35:00.000Z')

function n(overrides: { read_at?: string | null; created_at: string }) {
  return { read_at: overrides.read_at ?? null, created_at: overrides.created_at }
}

describe('unreadCount', () => {
  it('counts only items without read_at', () => {
    expect(
      unreadCount([
        n({ created_at: '2026-08-18T12:00:00.000Z' }),
        n({ created_at: '2026-08-18T11:00:00.000Z', read_at: '2026-08-18T11:01:00.000Z' }),
        n({ created_at: '2026-08-18T10:00:00.000Z' }),
      ]),
    ).toBe(2)
  })
})

describe('shouldPulseBell', () => {
  it('does not pulse when everything is read', () => {
    expect(
      shouldPulseBell({
        items: [n({ created_at: '2026-08-18T12:34:00.000Z', read_at: '2026-08-18T12:34:30.000Z' })],
        acknowledgedAt: null,
        now: NOW,
      }),
    ).toBe(false)
  })

  it('does not pulse for old unread backlog', () => {
    expect(
      shouldPulseBell({
        items: [n({ created_at: '2026-08-18T10:00:00.000Z' })],
        acknowledgedAt: null,
        now: NOW,
      }),
    ).toBe(false)
  })

  it('pulses for unread activity from the last few minutes', () => {
    expect(
      shouldPulseBell({
        items: [n({ created_at: '2026-08-18T12:33:00.000Z' })],
        acknowledgedAt: null,
        now: NOW,
      }),
    ).toBe(true)
  })

  it('stops pulsing after the person opens the bell past that activity', () => {
    expect(
      shouldPulseBell({
        items: [n({ created_at: '2026-08-18T12:33:00.000Z' })],
        acknowledgedAt: NOW,
        now: NOW,
      }),
    ).toBe(false)
  })

  it('pulses again if newer unread lands after they opened the bell', () => {
    expect(
      shouldPulseBell({
        items: [n({ created_at: '2026-08-18T12:34:30.000Z' })],
        acknowledgedAt: Date.parse('2026-08-18T12:34:00.000Z'),
        now: NOW,
      }),
    ).toBe(true)
  })
})

describe('newestUnreadAt', () => {
  it('ignores read rows', () => {
    expect(
      newestUnreadAt([
        n({ created_at: '2026-08-18T12:34:00.000Z', read_at: '2026-08-18T12:34:10.000Z' }),
        n({ created_at: '2026-08-18T12:30:00.000Z' }),
      ]),
    ).toBe(Date.parse('2026-08-18T12:30:00.000Z'))
  })
})
