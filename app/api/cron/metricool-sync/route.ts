import { NextRequest, NextResponse } from 'next/server'
import { runMetricoolPublishedSync } from '@/lib/metricool/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Background sync: every published Metricool post moves its dashboard card to
 * Publication. Triggered by the Vercel cron (see vercel.json). Protected by
 * CRON_SECRET — Vercel cron sends it as a Bearer token (set CRON_SECRET in the
 * project env). The `x-vercel-cron` header is accepted as a fallback signal that
 * the request came from Vercel's scheduler.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authed =
    (secret && req.headers.get('authorization') === `Bearer ${secret}`) ||
    req.headers.get('x-vercel-cron') !== null
  if (!authed) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const result = await runMetricoolPublishedSync()
  return NextResponse.json(result)
}
