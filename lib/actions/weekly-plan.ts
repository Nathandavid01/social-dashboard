'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { computeRunway } from '@/lib/utils/content-runway'
import { computePostingTargets } from '@/lib/utils/posting-cadence'
import { planWeek, type WeeklyPlan, type WeeklyPlanClient } from '@/lib/utils/weekly-plan-core'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { ESTADOS_VIVOS } from '@/lib/clients/estado'

const POST_TZ = 'America/Puerto_Rico'

/** Videos that still count as buffered content (not published, not discarded). */
const ACTIVE_STATUSES = ['idea', 'asignada', 'grabada', 'producida'] as const

/** Cap on ideas fetched. Hitting it means we're under-reporting — we say so. */
const MAX_IDEAS = 5000

/**
 * "Esta semana toca": which of the ~50 clients actually need a human this week.
 *
 * Nothing in the app looked ACROSS clients before — each one was evaluated in
 * isolation, so with 50 accounts you had to eyeball all of them.
 *
 * Returns null on failure so the caller can show an error. It must NOT degrade to
 * an empty plan: "no hay nada urgente" is the most dangerous lie this page could
 * tell.
 */
export async function getWeeklyPlan(): Promise<WeeklyPlan | null> {
  await requirePermission('runway.read')

  const supabase = await createClient()
  const today = todayISOInTimeZone(POST_TZ)

  const { data: clients, error: cErr } = await supabase
    .from('clients')
    .select('id, name, posting_days')
    .in('status', ESTADOS_VIVOS)
  if (cErr || !clients) {
    console.warn('[weekly-plan] clients fetch failed:', cErr?.message)
    return null
  }

  const activeIds = clients.map((c) => (c as { id: string }).id)
  if (activeIds.length === 0) return planWeek([], today)

  const { data: ideas, error: iErr } = await supabase
    .from('content_ideas')
    .select('client_id, status, publish_date')
    .in('status', ACTIVE_STATUSES as unknown as string[])
    // Only active clients: their ideas are the only ones that can matter, and
    // fetching the rest would eat the row budget below.
    .in('client_id', activeIds)
    // An unordered LIMIT drops an ARBITRARY subset — the clients whose rows got
    // dropped would show 0 content and be reported as URGENT. Order it.
    .order('client_id', { ascending: true })
    .limit(MAX_IDEAS)
  if (iErr || !ideas) {
    console.warn('[weekly-plan] ideas fetch failed:', iErr?.message)
    return null
  }
  if (ideas.length >= MAX_IDEAS) {
    // Refuse to render a list we know is wrong: the missing rows read as "this
    // client has no content", i.e. a false emergency.
    console.error(
      `[weekly-plan] hit the ${MAX_IDEAS}-idea cap — the plan would under-report content and raise false alarms. Aggregate server-side.`,
    )
    return null
  }

  type IdeaRow = { client_id: string | null; status: string; publish_date: string | null }
  const byClient = new Map<string, IdeaRow[]>()
  for (const row of ideas as IdeaRow[]) {
    if (!row.client_id) continue
    const arr = byClient.get(row.client_id) ?? []
    arr.push(row)
    byClient.set(row.client_id, arr)
  }

  const now = new Date()

  const rows: WeeklyPlanClient[] = clients.map((c) => {
    const client = c as { id: string; name: string; posting_days: number[] | null }
    const mine = byClient.get(client.id) ?? []

    // Same source as the board: dedupes and drops out-of-range weekdays. A raw
    // `.length` would count [1,1,3] as 3 posts/week and disagree with the board.
    const cadence = computePostingTargets(client.posting_days, now)
    const weeklyCadence = cadence.perWeek

    // The soonest commitment that isn't out yet. `dates` is sorted, so [0] is the
    // EARLIEST — an overdue date leads, which is exactly right: a commitment you
    // already missed is the most urgent thing on the list, not the least.
    const dates = mine
      .map((i) => i.publish_date)
      .filter((d): d is string => !!d)
      .sort()

    // No ideas at all is the WORST case, not the calmest — but it has no dates to
    // sort by. Fall back to their cadence: they still publish next Thursday even
    // if nobody has created the video yet.
    const nextPublishDate = dates[0] ?? cadence.upcomingDates[0] ?? null

    return {
      clientId: client.id,
      clientName: client.name,
      weeklyCadence,
      nextPublishDate,
      runway: computeRunway({
        // `asignada` = booked for a shoot but not shot yet. It's still an idea in
        // the bank; dropping it (as this did) punished clients for being PLANNED —
        // a fully scheduled client showed up as "urgent, no content".
        ideas: mine.filter((i) => i.status === 'idea' || i.status === 'asignada').length,
        porEditar: mine.filter((i) => i.status === 'grabada').length,
        porPublicar: mine.filter((i) => i.status === 'producida').length,
        weeklyCadence,
      }),
    }
  })

  return planWeek(rows, today)
}
