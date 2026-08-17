'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import {
  applyHeartbeat,
  rankMembers,
  weekStartMonday,
  PRESENCE_TZ,
  type PresenceDayRow,
  type RankedMember,
} from '@/lib/utils/presence-core'

export interface TeamTimeBoard {
  day: string
  weekStart: string
  members: RankedMember[]
  team_week_seconds: number
  live_count: number
}

/** Latido del browser. Nunca lanza: si la tabla no existe o falla RLS, { error }. */
export async function recordHeartbeat(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const day = todayISOInTimeZone(PRESENCE_TZ)
  const now = new Date()

  const { data: existing, error: readError } = await supabase
    .from('user_time_days')
    .select('user_id, day, active_seconds, last_beat_at')
    .eq('user_id', user.id)
    .eq('day', day)
    .maybeSingle()

  if (readError) return { error: 'Jornada no disponible' }

  const next = applyHeartbeat(
    existing
      ? { last_beat_at: existing.last_beat_at, active_seconds: existing.active_seconds }
      : null,
    now,
  )

  const { error } = await supabase.from('user_time_days').upsert(
    {
      user_id: user.id,
      day,
      active_seconds: next.active_seconds,
      last_beat_at: next.last_beat_at,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id,day' },
  )
  if (error) return { error: 'Jornada no disponible' }
  return { ok: true }
}

export async function getTeamTimeBoard(): Promise<TeamTimeBoard> {
  const empty = (day: string, weekStart: string): TeamTimeBoard => ({
    day, weekStart, members: [], team_week_seconds: 0, live_count: 0,
  })
  try {
    await requirePermission('presence.read')
  } catch {
    const day = todayISOInTimeZone(PRESENCE_TZ)
    return empty(day, weekStartMonday(day))
  }

  const day = todayISOInTimeZone(PRESENCE_TZ)
  const weekStart = weekStartMonday(day)
  const supabase = await createClient()
  const now = new Date()

  const [{ data: people, error: peopleError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('status', 'active')
      .eq('approval_status', 'approved')
      .order('full_name'),
    supabase
      .from('user_time_days')
      .select('user_id, day, active_seconds, last_beat_at')
      .gte('day', weekStart)
      .lte('day', day),
  ])

  if (peopleError || rowsError) return empty(day, weekStart)

  const members = rankMembers(
    (people ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[],
    (rows ?? []) as PresenceDayRow[],
    { today: day, weekStart, now },
  )
  return {
    day,
    weekStart,
    members,
    team_week_seconds: members.reduce((n, m) => n + m.week_seconds, 0),
    live_count: members.filter((m) => m.live).length,
  }
}
