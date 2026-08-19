import type { SupabaseClient } from '@supabase/supabase-js'
import { schedulesAfterPostingDaysChange } from '@/lib/utils/posting-days-sot'
import type { CadenceType } from '@/lib/utils/next-autopost-core'

/** Keep production_schedules days aligned with the profile chips. */
export async function syncSchedulesToPostingDays(
  supabase: SupabaseClient,
  clientId: string,
  postingDays: number[],
): Promise<void> {
  const { data: existing } = await supabase
    .from('production_schedules')
    .select('day_of_week, content_type')
    .eq('client_id', clientId)

  const rows = (existing ?? []) as { day_of_week: number; content_type: CadenceType }[]
  const next = schedulesAfterPostingDaysChange(rows, postingDays)
  const isoKeep = Array.from(new Set(next.map((s) => s.day_of_week)))

  if (isoKeep.length === 0) {
    await supabase.from('production_schedules').delete().eq('client_id', clientId)
    return
  }

  await supabase
    .from('production_schedules')
    .delete()
    .eq('client_id', clientId)
    .not('day_of_week', 'in', `(${isoKeep.join(',')})`)

  const have = new Set(
    rows.filter((s) => isoKeep.includes(s.day_of_week)).map((s) => `${s.day_of_week}|${s.content_type}`),
  )
  const inserts = next.filter((s) => !have.has(`${s.day_of_week}|${s.content_type}`))
  if (inserts.length === 0) return

  await supabase.from('production_schedules').upsert(
    inserts.map((s) => ({
      client_id: clientId,
      day_of_week: s.day_of_week,
      content_type: s.content_type,
    })),
    { onConflict: 'client_id,day_of_week,content_type' },
  )
}
