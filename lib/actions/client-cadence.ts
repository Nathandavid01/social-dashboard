'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import { CADENCIA_TAG } from '@/lib/actions/cadencia-tag'
import { syncSchedulesToPostingDays } from '@/lib/actions/sync-posting-cadence'
import {
  cadenceRevalidatePaths,
  cleanPostingDays,
  cleanPostingSchedule,
  cleanPostingTime,
  cleanTimezone,
  isMissingTimezoneColumn,
  pruneScheduleToDays,
} from '@/lib/utils/client-cadence'

export interface ClientCadencePatch {
  posting_days?: number[]
  posting_time?: string | null
  posting_schedule?: Record<string, string>
  posting_timezone?: string | null
}

export async function revalidateClientCadence(clientId: string): Promise<void> {
  revalidateTag(CADENCIA_TAG)
  for (const path of cadenceRevalidatePaths(clientId)) revalidatePath(path)
}

/**
 * Single write path for per-client posting cadence. Stores only the fields a
 * person sent. Does not invent days, times, schedules, or a timezone.
 */
export async function updateClientCadence(
  clientId: string,
  input: ClientCadencePatch,
): Promise<{ ok?: true; error?: string }> {
  if (!(await currentUserHas('cadence.edit'))) {
    return { error: 'No autorizado' }
  }
  if (!clientId) return { error: 'Cliente requerido' }

  const patch: Record<string, unknown> = {}
  if (Array.isArray(input.posting_days)) {
    patch.posting_days = cleanPostingDays(input.posting_days)
  }
  if ('posting_time' in input) {
    patch.posting_time = cleanPostingTime(input.posting_time)
  }
  if (input.posting_schedule) {
    const schedule = cleanPostingSchedule(input.posting_schedule)
    const days = Array.isArray(patch.posting_days) ? (patch.posting_days as number[]) : null
    patch.posting_schedule = days ? pruneScheduleToDays(schedule, days) : schedule
  }
  if ('posting_timezone' in input) {
    patch.posting_timezone = cleanTimezone(input.posting_timezone)
  }

  if (Object.keys(patch).length === 0) return { ok: true }

  const supabase = await createClient()
  const stamped: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
  let { error } = await supabase.from('clients').update(stamped).eq('id', clientId)

  if (error && 'posting_timezone' in patch && isMissingTimezoneColumn(error)) {
    const { posting_timezone: _ignored, ...withoutTz } = stamped
    if (Object.keys(withoutTz).length <= 1) {
      // only timezone + updated_at — column not applied yet
      await revalidateClientCadence(clientId)
      return { ok: true }
    }
    const retry = await supabase.from('clients').update(withoutTz).eq('id', clientId)
    error = retry.error
  }

  if (error) return { error: error.message }

  if (Array.isArray(patch.posting_days)) {
    await syncSchedulesToPostingDays(supabase, clientId, patch.posting_days as number[])
  }

  await revalidateClientCadence(clientId)
  return { ok: true }
}
