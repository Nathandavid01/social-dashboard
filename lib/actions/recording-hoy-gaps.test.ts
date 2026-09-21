import { beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ allowed: true, from: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({ currentUserHas: vi.fn(async () => h.allowed) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: h.from }) }))
vi.mock('@/lib/utils/read-complete-pages', () => ({ readCompletePages: h.read }))

import { getRecordingHoyGaps } from './recording-hoy-gaps'

beforeEach(() => {
  h.allowed = true
  h.from.mockReset()
  h.read.mockReset()
})

it('does not query and does not throw without recording.read (landing-safe)', async () => {
  h.allowed = false
  const r = await getRecordingHoyGaps()
  expect(r.visible).toBe(false)
  expect(r.actionableCount).toBe(0)
  expect(r.error).toBeUndefined()
  expect(h.read).not.toHaveBeenCalled()
})

it('reports a query failure instead of a silent zero', async () => {
  h.read.mockRejectedValue(new Error('partial'))
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-21T16:00:00Z'))
  try {
    const r = await getRecordingHoyGaps()
    expect(r.visible).toBe(true)
    expect(r.error).toBeTruthy()
    expect(r.actionableCount).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

it('loads upcoming sessions with start_time and counts actionable gaps', async () => {
  h.read
    .mockResolvedValueOnce([
      {
        id: 's',
        title: 'Cliente',
        session_date: '2026-09-22',
        status: 'scheduled',
        client_id: null,
        client: null,
        videographer_id: null,
        start_time: null,
      },
    ])
    .mockResolvedValueOnce([])
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-21T16:00:00Z'))
  try {
    const r = await getRecordingHoyGaps()
    expect(r.visible).toBe(true)
    expect(r.unconfirmed).toHaveLength(1)
    expect(r.sinVideo).toHaveLength(1)
    expect(r.actionableCount).toBe(1)
    expect(h.read).toHaveBeenCalledTimes(2)
  } finally {
    vi.useRealTimers()
  }
})
