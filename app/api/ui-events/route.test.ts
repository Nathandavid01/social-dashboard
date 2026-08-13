import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn(async () => ({ data: { user: { id: 'u1' } } }))
let inserted: unknown[] | null = null
let insertError: { message: string } | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      insert: async (rows: unknown[]) => {
        inserted = rows
        return { error: insertError }
      },
    }),
  }),
}))

import { POST } from './route'

beforeEach(() => {
  inserted = null
  insertError = null
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } } })
})

function req(body: unknown) {
  return new Request('http://localhost/api/ui-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/ui-events', () => {
  it('rejects anonymous callers', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } } as never)
    const res = await POST(req({ events: [{ kind: 'click', path: '/home', label: 'Ir' }] }))
    expect(res.status).toBe(401)
    expect(inserted).toBeNull()
  })

  it('stamps user_id from the session, not the client', async () => {
    const res = await POST(
      req({
        events: [{ kind: 'click', path: '/home', label: 'Ir', target: 'button', user_id: 'hacker' }],
      }),
    )
    expect(res.status).toBe(200)
    expect(inserted).toEqual([
      { user_id: 'u1', kind: 'click', path: '/home', label: 'Ir', target: 'button' },
    ])
  })

  it('rejects a malformed body', async () => {
    const res = await POST(req({ nope: true }))
    expect(res.status).toBe(400)
    expect(inserted).toBeNull()
  })
})
