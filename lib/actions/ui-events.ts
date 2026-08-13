'use server'

import { assertOwner } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import type { UiEvent } from '@/lib/supabase/types'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { dayBoundsIso, isDayIso, UI_EVENT_TZ } from '@/lib/utils/ui-events-core'

export interface UiEventLogEntry extends UiEvent {}

/**
 * Owner-only session log: clicks + route changes for one Puerto Rico calendar day.
 * Returns [] if the caller is not owner or the read fails.
 */
export async function getUiEvents(opts?: {
  day?: string | null
  userId?: string | null
  limit?: number
}): Promise<UiEventLogEntry[]> {
  try {
    await assertOwner()
  } catch {
    return []
  }

  const day = isDayIso(opts?.day) ? opts!.day! : todayISOInTimeZone(UI_EVENT_TZ)
  const { gte, lt } = dayBoundsIso(day)
  const supabase = await createClient()
  let query = supabase
    .from('ui_events')
    .select('*, user:profiles(id, full_name)')
    .gte('created_at', gte)
    .lt('created_at', lt)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(opts?.limit ?? 500, 1), 1000))

  if (opts?.userId) query = query.eq('user_id', opts.userId)

  const { data, error } = await query
  if (error) {
    console.warn('[ui-events] read failed:', error.message)
    return []
  }
  return (data ?? []) as unknown as UiEventLogEntry[]
}
