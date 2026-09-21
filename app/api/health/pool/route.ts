import { NextResponse } from 'next/server'
import { buildPoolHealth } from '@/lib/utils/pool-smoke'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * Public health for Panel (`/pool`). Never talks to Supabase, so a preview
 * without env still returns 200 instead of 500. The HTTP smoke also hits
 * `/pool` itself (auth redirect is OK; 5xx is not).
 */
export async function GET() {
  return NextResponse.json(buildPoolHealth())
}
