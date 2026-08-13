import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dayBoundsIso } from '@/lib/utils/ui-events-core'

const assertOwner = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({ assertOwner: () => assertOwner() }))

let lastQuery: { gte?: string; lt?: string; userId?: string; limit?: number } = {}
let rows: unknown[] = []
let readError: { message: string } | null = null

function makeSupabase() {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  Object.assign(builder, {
    select: self,
    order: self,
    limit: (n: number) => {
      lastQuery.limit = n
      return builder
    },
    gte: (_col: string, v: string) => {
      lastQuery.gte = v
      return builder
    },
    lt: (_col: string, v: string) => {
      lastQuery.lt = v
      return builder
    },
    eq: (col: string, v: string) => {
      if (col === 'user_id') lastQuery.userId = v
      return builder
    },
    then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: readError }),
  })
  return { from: vi.fn(() => builder) }
}

let supa = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { getUiEvents } from './ui-events'

beforeEach(() => {
  lastQuery = {}
  rows = []
  readError = null
  assertOwner.mockReset().mockResolvedValue(undefined)
  supa = makeSupabase()
})

describe('getUiEvents', () => {
  it('returns [] and does not query when the caller is not owner', async () => {
    assertOwner.mockRejectedValueOnce(new Error('Esta acción requiere rol de Owner.'))
    const out = await getUiEvents({ day: '2026-08-13' })
    expect(out).toEqual([])
    expect(supa.from).not.toHaveBeenCalled()
  })

  it('scopes the query to the Puerto Rico calendar day', async () => {
    const bounds = dayBoundsIso('2026-08-13')
    await getUiEvents({ day: '2026-08-13' })
    expect(lastQuery.gte).toBe(bounds.gte)
    expect(lastQuery.lt).toBe(bounds.lt)
  })

  it('filters by user when asked', async () => {
    await getUiEvents({ day: '2026-08-13', userId: 'eric-1' })
    expect(lastQuery.userId).toBe('eric-1')
  })

  it('returns the rows on success and [] on read failure', async () => {
    rows = [{ id: 'e1', user_id: 'u1', kind: 'click', path: '/home', label: 'Ir', target: 'button', created_at: '2026-08-13T12:00:00Z' }]
    expect(await getUiEvents({ day: '2026-08-13' })).toHaveLength(1)
    readError = { message: 'boom' }
    rows = []
    expect(await getUiEvents({ day: '2026-08-13' })).toEqual([])
  })
})
