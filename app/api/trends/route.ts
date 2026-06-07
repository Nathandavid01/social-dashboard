import { NextRequest, NextResponse } from 'next/server'
import { fetchGoogleTrends, DEFAULT_TRENDS_GEO } from '@/lib/integrations/trends'

/**
 * GET /api/trends?geo=PR — current "trending now" topics for the Idea Lab.
 * Always 200 with a (possibly empty) `trends` array; the UI degrades to
 * manual trend entry when the source is unavailable.
 */
export async function GET(req: NextRequest) {
  const geo = req.nextUrl.searchParams.get('geo') ?? DEFAULT_TRENDS_GEO
  const trends = await fetchGoogleTrends(geo)
  return NextResponse.json({ trends, geo, source: 'google' })
}
