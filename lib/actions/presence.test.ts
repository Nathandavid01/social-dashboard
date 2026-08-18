import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => {})
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
}))

let user: { id: string } | null = { id: 'u1' }
let existing: { user_id: string; day: string; active_seconds: number; last_beat_at: string | null } | null = null
let readError: { message: string } | null = null
let upsertError: { message: string } | null = null
let upserted: unknown = null
let people: unknown[] = []
let rows: unknown[] = []

function makeSupabase() {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'user_time_days') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: existing, error: readError }),
              }),
            }),
            gte: () => ({
              lte: async () => ({ data: rows, error: null }),
            }),
          }),
          upsert: async (row: unknown) => {
            upserted = row
            return { error: upsertError }
          },
        }
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: async () => ({ data: people, error: null }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }
}

let supa = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { recordHeartbeat, getTeamTimeBoard } from './presence'
import { PRESENCE_TZ } from '@/lib/utils/presence-core'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'

beforeEach(() => {
  user = { id: 'u1' }
  existing = null
  readError = null
  upsertError = null
  upserted = null
  people = []
  rows = []
  requirePermission.mockReset().mockResolvedValue(undefined)
  supa = makeSupabase()
})

describe('recordHeartbeat', () => {
  it('sin sesión: no autorizado', async () => {
    user = null
    expect(await recordHeartbeat()).toEqual({ error: 'No autorizado' })
  })

  it('tabla ausente: Jornada no disponible', async () => {
    readError = { message: 'relation does not exist' }
    expect(await recordHeartbeat()).toEqual({ error: 'Jornada no disponible' })
  })

  it('primer latido: upsert con 0 segundos', async () => {
    expect(await recordHeartbeat()).toEqual({ ok: true })
    expect(upserted).toEqual(expect.objectContaining({
      user_id: 'u1',
      active_seconds: 0,
    }))
  })

  it('segundo latido 60s después: suma 60', async () => {
    existing = {
      user_id: 'u1', day: '2026-08-16', active_seconds: 0,
      last_beat_at: new Date(Date.now() - 60_000).toISOString(),
    }
    expect(await recordHeartbeat()).toEqual({ ok: true })
    expect(upserted).toEqual(expect.objectContaining({
      user_id: 'u1',
      active_seconds: 60,
    }))
  })
})

describe('getTeamTimeBoard', () => {
  it('sin permiso: tablero vacío, no consulta', async () => {
    requirePermission.mockRejectedValueOnce(new Error('denied'))
    const out = await getTeamTimeBoard()
    expect(out.members).toEqual([])
    expect(supa.from).not.toHaveBeenCalled()
  })

  it('arma el ranking de la semana', async () => {
    const today = todayISOInTimeZone(PRESENCE_TZ)
    people = [
      { id: 'u1', full_name: 'Ana', avatar_url: null },
      { id: 'u2', full_name: 'Beto', avatar_url: null },
    ]
    rows = [
      { user_id: 'u2', day: today, active_seconds: 4000, last_beat_at: null },
      { user_id: 'u1', day: today, active_seconds: 1200, last_beat_at: null },
    ]
    const out = await getTeamTimeBoard()
    expect(out.members.map((m) => m.user_id)).toEqual(['u2', 'u1'])
    expect(out.team_week_seconds).toBe(5200)
    expect(requirePermission).toHaveBeenCalledWith('presence.read')
  })
})
