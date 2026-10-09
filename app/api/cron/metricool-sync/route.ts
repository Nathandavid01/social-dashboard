import { NextRequest, NextResponse } from 'next/server'
import { runMetricoolPublishedSync } from '@/lib/metricool/sync'
import { runReciboPublishedMatch } from '@/lib/recibo/sync-published'
import { getAgencyReach } from '@/lib/actions/agency-reach'
import { cronAuthDenial } from '@/lib/auth/cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** The Recibo match must never eat the 60 s the core sync below needs. */
const RECIBO_BUDGET_MS = 20_000

/**
 * Background sync: every published Metricool post moves its dashboard card to
 * Publication. Triggered by the Vercel cron (see vercel.json). Protected by
 * CRON_SECRET — ONLY `Authorization: Bearer <CRON_SECRET>` authorizes (see
 * lib/auth/cron.ts). Fails closed: no CRON_SECRET in env → never runs.
 */
export async function GET(req: NextRequest) {
  const denial = cronAuthDenial(req)
  if (denial) return NextResponse.json(denial.body, { status: denial.status })

  // First link Recibo cuts the team posted by hand in Metricool, so the sync
  // below flips the live ones to 'publicada' in this same run. Best-effort.
  // A deadline the match honours (no measuring or writing past it), not a race:
  // a raced run would keep writing after the response is sent.
  const recibo = await runReciboPublishedMatch({ deadline: Date.now() + RECIBO_BUDGET_MS }).catch((err) => ({
    linked: 0,
    error: err instanceof Error ? err.message : String(err),
  }))
  const result = await runMetricoolPublishedSync()

  // Warm the daily reach cache so the login counter reads it instantly (and
  // doesn't recompute 60+ accounts on a visitor's request). Best-effort.
  const reach = await getAgencyReach().catch(() => null)

  return NextResponse.json({ ...result, recibo, reachWarmed: reach })
}
