import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  role: 'supervisor' as string | null,
  user: { id: 'user-1' } as { id: string } | null,
  selectEq: vi.fn(),
  insert: vi.fn(),
  order: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  getCurrentRole: async () => h.role,
  getEffectiveRole: async () => h.role,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => {
      if (table !== 'client_suggestions') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          eq: (_col: string, _id: string) => ({
            order: (...args: unknown[]) => h.order(...args),
          }),
        }),
        insert: (row: unknown) => ({
          select: () => ({
            single: () => h.insert(row),
          }),
        }),
      }
    },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addClientSuggestion, listClientSuggestions } from './client-suggestions'

describe('listClientSuggestions', () => {
  beforeEach(() => {
    h.role = 'supervisor'
    h.order.mockReset()
    h.order.mockResolvedValue({
      data: [
        {
          id: '1',
          client_id: 'c1',
          body: 'A',
          source: 'whatsapp',
          created_by: null,
          created_at: '2026-02-01T00:00:00Z',
        },
      ],
      error: null,
    })
  })

  it('returns suggestions newest-first for readers', async () => {
    const res = await listClientSuggestions('c1')
    expect(res.error).toBeUndefined()
    expect(res.suggestions).toHaveLength(1)
    expect(res.suggestions[0].body).toBe('A')
  })

  it('denies users without clients.read or ideas.read', async () => {
    h.role = null
    const res = await listClientSuggestions('c1')
    expect(res.error).toMatch(/permiso/i)
    expect(res.suggestions).toEqual([])
  })

  it('allows idea writers via ideas.read (editor)', async () => {
    h.role = 'editor'
    const res = await listClientSuggestions('c1')
    expect(res.error).toBeUndefined()
    expect(res.suggestions).toHaveLength(1)
  })
})

describe('addClientSuggestion', () => {
  beforeEach(() => {
    h.role = 'supervisor'
    h.user = { id: 'user-1' }
    h.insert.mockReset()
    h.insert.mockImplementation(async (row: Record<string, unknown>) => ({
      data: {
        id: 's1',
        ...row,
        created_at: '2026-09-11T00:00:00Z',
      },
      error: null,
    }))
  })

  it('inserts when user has clients.brand.edit / clients.edit', async () => {
    const res = await addClientSuggestion({
      clientId: 'c1',
      body: '  Quiere video de cocina  ',
      source: 'whatsapp',
    })
    expect(res.error).toBeUndefined()
    expect(res.suggestion?.body).toBe('Quiere video de cocina')
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'c1',
        body: 'Quiere video de cocina',
        source: 'whatsapp',
        created_by: 'user-1',
      }),
    )
  })

  it('blocks editors without brand/edit permission', async () => {
    h.role = 'editor'
    const res = await addClientSuggestion({ clientId: 'c1', body: 'x' })
    expect(res.error).toMatch(/permiso/i)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('rejects empty body without hitting the DB', async () => {
    const res = await addClientSuggestion({ clientId: 'c1', body: '  ' })
    expect(res.error).toMatch(/sugerencia/i)
    expect(h.insert).not.toHaveBeenCalled()
  })
})
