import { NextRequest, NextResponse } from 'next/server'
import { runMetricoolPublishedSync } from '@/lib/metricool/sync'
import { getAgencyReach } from '@/lib/actions/agency-reach'
import { cronAuthDenial } from '@/lib/auth/cron'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Background sync: every published Metricool post moves its dashboard card to
 * Publication. Triggered by the Vercel cron (see vercel.json). Protected by
 * CRON_SECRET — ONLY `Authorization: Bearer <CRON_SECRET>` authorizes (see
 * lib/auth/cron.ts). Fails closed: no CRON_SECRET in env → never runs.
 */
export async function GET(req: NextRequest) {
  const denial = cronAuthDenial(req)
  if (denial) return NextResponse.json(denial.body, { status: denial.status })

  const result = await runMetricoolPublishedSync()

  // Warm the daily reach cache so the login counter reads it instantly (and
  // doesn't recompute 60+ accounts on a visitor's request). Best-effort.
  const reach = await getAgencyReach().catch(() => null)

  return NextResponse.json({ ...result, reachWarmed: reach })
}
