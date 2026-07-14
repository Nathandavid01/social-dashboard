'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { computeRunway } from '@/lib/utils/content-runway'
import { planWeek, type WeeklyPlan, type WeeklyPlanClient } from '@/lib/utils/weekly-plan-core'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'

const POST_TZ = 'America/Puerto_Rico'

/** The pipeline stages a video can sit in while still being "buffered content". */
const ACTIVE_STATUSES = ['idea', 'asignada', 'grabada', 'producida'] as const

/**
 * "Esta semana toca": which of the ~50 clients actually need a human this week.
 *
 * Nothing in the app looked ACROSS clients before — each one was evaluated in
 * isolation, so with 50 accounts you had to eyeball all of them. This ranks them
 * by how close they are to running out of content, and (crucially) breaks ties by
 * who publishes soonest: on the live account every client sits at zero buffered
 * content, so without that tiebreak the "short list" would be alphabetical.
 */
export async function getWeeklyPlan(): Promise<WeeklyPlan | null> {
  await requirePermission('runway.read')

  const supabase = await createClient()
  const today = todayISOInTimeZone(POST_TZ)

  const [{ data: clients, error: cErr }, { data: ideas, error: iErr }] = await Promise.all([
    supabase.from('clients').select('id, name, posting_days').eq('status', 'active'),
    supabase
      .from('content_ideas')
      .select('client_id, status, publish_date')
      .in('status', ACTIVE_STATUSES as unknown as string[])
      .limit(2000),
  ])

  if (cErr || iErr) {
    console.warn('[weekly-plan] fetch failed:', cErr?.message ?? iErr?.message)
    return null
  }

  type IdeaRow = { client_id: string | null; status: string; publish_date: string | null }
  const byClient = new Map<string, IdeaRow[]>()
  for (const row of (ideas ?? []) as IdeaRow[]) {
    if (!row.client_id) continue
    const arr = byClient.get(row.client_id) ?? []
    arr.push(row)
    byClient.set(row.client_id, arr)
  }

  const rows: WeeklyPlanClient[] = (clients ?? []).map((c) => {
    const client = c as { id: string; name: string; posting_days: number[] | null }
    const mine = byClient.get(client.id) ?? []
    // Posts per week = how many weekdays they post on.
    const weeklyCadence = (client.posting_days ?? []).length

    // The soonest date they're committed to publish something not yet out. Past
    // dates count: an overdue commitment is MORE urgent, not less.
    const dates = mine
      .map((i) => i.publish_date)
      .filter((d): d is string => !!d)
      .sort()
    const nextPublishDate = dates.find((d) => d >= today) ?? dates[0] ?? null

    return {
      clientId: client.id,
      clientName: client.name,
      weeklyCadence,
      nextPublishDate,
      runway: computeRunway({
        ideas: mine.filter((i) => i.status === 'idea').length,
        porEditar: mine.filter((i) => i.status === 'grabada').length,
        porPublicar: mine.filter((i) => i.status === 'producida').length,
        weeklyCadence,
      }),
    }
  })

  return planWeek(rows)
}
