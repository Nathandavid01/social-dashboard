import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pruneBefore } from '@/lib/utils/ui-events-core'
import { cronAuthDenial } from '@/lib/auth/cron'

export const dynamic = 'force-dynamic'

/**
 * Drops ui_events older than 7 days. Same CRON_SECRET gate as the other
 * nightly jobs (lib/auth/cron.ts) — fails closed. Uses the service role so
 * RLS does not block deletes.
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const denial = cronAuthDenial(req)
  if (denial) return NextResponse.json(denial.body, { status: denial.status })

  const cutoff = pruneBefore().toISOString()
  const { error, count } = await admin()
    .from('ui_events')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  if (error) {
    console.error('[ui-events-prune]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deleted: count ?? 0, cutoff })
}
