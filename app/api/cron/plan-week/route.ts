import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { planWeekInserts, type PlanWeekClient, type PlanWeekExistingIdea } from '@/lib/utils/plan-week-core'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** All schedule math anchors to the posting timezone, never the server's UTC. */
const POST_TZ = 'America/Puerto_Rico'

/**
 * Daily card auto-creation: for every ACTIVE client with a posting cadence
 * (clients.posting_days), materialize the coming week's content_ideas so each
 * publication day "opens" its card by itself — the team just fills in the
 * video, caption and title. Idempotent: dates that already have an idea for
 * that client (even discarded) are never re-created, so re-runs and manual
 * triggers are safe. Protected by CRON_SECRET, same as the other crons.
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    (secret && req.headers.get('authorization') === `Bearer ${secret}`) ||
    req.headers.get('x-vercel-cron') !== null
  if (!authed) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const sb = admin()
  const todayISO = todayISOInTimeZone(POST_TZ)

  const [{ data: clients, error: clientsErr }, { data: existing, error: ideasErr }] = await Promise.all([
    sb.from('clients').select('id, name, status, posting_days').eq('status', 'active'),
    // Every idea dated today-or-later blocks its (client, date) slot — including
    // 'descartada' (the team explicitly killed that slot; don't resurrect it).
    sb.from('content_ideas').select('client_id, publish_date').gte('publish_date', todayISO),
  ])
  if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 500 })
  if (ideasErr) return NextResponse.json({ error: ideasErr.message }, { status: 500 })

  const inserts = planWeekInserts(
    (clients ?? []) as PlanWeekClient[],
    (existing ?? []) as PlanWeekExistingIdea[],
    todayISO,
  )

  if (inserts.length === 0) {
    return NextResponse.json({ ok: true, created: 0, todayISO })
  }

  const { error: insertErr } = await sb.from('content_ideas').insert(inserts)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  revalidatePath('/pipeline')
  revalidatePath('/planning')

  return NextResponse.json({
    ok: true,
    created: inserts.length,
    todayISO,
    byClient: inserts.reduce<Record<string, number>>((acc, i) => {
      acc[i.client_id] = (acc[i.client_id] ?? 0) + 1
      return acc
    }, {}),
  })
}
