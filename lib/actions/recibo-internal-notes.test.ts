import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath } from 'next/cache'
import { addReciboInternalNote, listReciboInternalNotes } from './recibo-internal-notes'

const h = vi.hoisted(() => ({
  allowed: new Set<string>(['entregas.read']),
  user: { id: 'u1' } as { id: string } | null,
  profile: { full_name: 'Eric Perez' } as { full_name: string } | null,
  insertError: null as { message: string } | null,
  inserts: [] as Record<string, unknown>[],
  notes: [
    {
      id: 'n1',
      author_name: 'Eric Perez',
      body: 'El hook no se entiende',
      created_at: '2026-10-05T12:00:00Z',
    },
  ],
}))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async (perm: string) => {
    if (!h.allowed.has(perm)) throw new Error(`Acceso denegado (falta permiso: ${perm})`)
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: h.profile, error: null }),
            }),
          }),
        }
      }
      if (table === 'recibo_internal_notes') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: h.notes, error: null }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            h.inserts.push(row)
            return { error: h.insertError }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

describe('addReciboInternalNote', () => {
  beforeEach(() => {
    h.allowed = new Set(['entregas.read'])
    h.user = { id: 'u1' }
    h.profile = { full_name: 'Eric Perez' }
    h.insertError = null
    h.inserts = []
    vi.mocked(revalidatePath).mockClear()
  })

  it('rechaza un motivo vacío', async () => {
    const res = await addReciboInternalNote('idea-1', '   ')
    expect(res.error).toMatch(/escribe un motivo/i)
    expect(h.inserts).toHaveLength(0)
  })

  it('exige entregas.read', async () => {
    h.allowed.clear()
    const res = await addReciboInternalNote('idea-1', 'El corte se ve oscuro')
    expect(res.error).toMatch(/entregas.read/)
    expect(h.inserts).toHaveLength(0)
  })

  it('guarda el motivo interno y refresca Recibo', async () => {
    const res = await addReciboInternalNote('idea-1', 'El hook no se entiende')
    expect(res).toEqual({ ok: true })
    expect(h.inserts).toEqual([
      {
        content_idea_id: 'idea-1',
        author_id: 'u1',
        author_name: 'Eric Perez',
        body: 'El hook no se entiende',
      },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/recibo')
    expect(revalidatePath).not.toHaveBeenCalledWith('/clients')
    expect(revalidatePath).not.toHaveBeenCalledWith('/review')
  })
})

describe('listReciboInternalNotes', () => {
  it('exige entregas.read', async () => {
    h.allowed.clear()
    await expect(listReciboInternalNotes('idea-1')).resolves.toEqual([])
  })

  it('devuelve solo notas internas de Recibo', async () => {
    h.allowed = new Set(['entregas.read'])
    await expect(listReciboInternalNotes('idea-1')).resolves.toEqual(h.notes)
  })
})
