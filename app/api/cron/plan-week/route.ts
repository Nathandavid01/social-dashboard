import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { addDaysISO, todayISOInTimeZone } from '@/lib/utils/deadlines'
import { planWeekInserts, type PlanWeekClient, type PlanWeekExistingIdea } from '@/lib/utils/plan-week-core'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 60

/** All schedule math anchors to the posting timezone, never the server's UTC. */
const POST_TZ = 'America/Puerto_Rico'

/**
 * Daily card auto-creation: for every ACTIVE client with a posting cadence
 * (clients.posting_days), materialize the coming week's content_ideas so each
 * publication day "opens" its card by itself — the team just fills in the
 * video, caption and title.
 *
 * Safe against real production data (see plan-week-core):
 * - Idempotent: dates that already have an idea for that client (even
 *   discarded) are never re-created — re-runs and manual triggers are safe.
 * - In-flight accounting: every active unpublished idea (dated or NOT — most
 *   manual videos have no publish_date) consumes one upcoming slot, so a
 *   client with a full plate gets NO new cards until work ships. This keeps
 *   the cron from spamming worked clients, dragging batch cards back to the
 *   Video column, or accumulating rows without bound.
 * Protected by CRON_SECRET, same as the other crons.
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        // CRITICAL: Next patches global fetch and served this route's GET
        // SELECTs from its Data Cache — every run saw the first run's EMPTY
        // board and re-created all cards (verified live 2026-07-02: 4 runs =
        // 4×154 duplicates). Inserts (POST) were never cached, which is why
        // only reads went stale. Bypass the cache for every supabase call.
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    },
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
  const DAYS_AHEAD = 7
  const endISO = addDaysISO(todayISO, DAYS_AHEAD)

  const [{ data: clients, error: clientsErr }, { data: existing, error: ideasErr }, { data: inFlight, error: flightErr }] =
    await Promise.all([
      sb.from('clients').select('id, name, status, posting_days').eq('status', 'active'),
      // Every idea dated inside the window blocks its (client, date) slot —
      // including 'descartada' (the team explicitly killed that slot; don't
      // resurrect it). Bounded to the window so the result set stays small.
      sb
        .from('content_ideas')
        .select('client_id, publish_date')
        .gte('publish_date', todayISO)
        .lte('publish_date', endISO)
        .limit(2000),
      // The in-flight plate: every active, unpublished idea (dated or not)
      // consumes one upcoming slot — a busy client gets NO new cards.
      sb
        .from('content_ideas')
        .select('client_id')
        .not('status', 'in', '(descartada,publicada)')
        .is('published_at', null)
        .limit(5000),
    ])
  if (clientsErr) return NextResponse.json({ error: clientsErr.message }, { status: 500 })
  if (ideasErr) return NextResponse.json({ error: ideasErr.message }, { status: 500 })
  if (flightErr) return NextResponse.json({ error: flightErr.message }, { status: 500 })

  const inFlightByClient = (inFlight ?? []).reduce<Record<string, number>>((acc, row) => {
    const id = (row as { client_id: string | null }).client_id
    if (id) acc[id] = (acc[id] ?? 0) + 1
    return acc
  }, {})

  const inserts = planWeekInserts(
    (clients ?? []) as PlanWeekClient[],
    (existing ?? []) as PlanWeekExistingIdea[],
    inFlightByClient,
    todayISO,
    DAYS_AHEAD,
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
