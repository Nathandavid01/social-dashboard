import 'server-only'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { sumPostReach } from '@/lib/utils/reach-core'

// Total "personas alcanzadas" across every Metricool account we operate, for the
// login counter. Server-only: uses the Metricool team token (never shipped to
// the client) and the per-client blogIds. Heavy, so it's cached ~1×/day.

const METRICOOL_BASE = 'https://app.metricool.com/api'
const WINDOW_DAYS = 365

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

async function blogReach(
  userToken: string,
  userId: string,
  blogId: string,
  start: string,
  end: string,
): Promise<{ blogId: string; reach: number; ok: boolean }> {
  const url = new URL(`${METRICOOL_BASE}/stats/posts`)
  url.searchParams.set('userId', userId)
  url.searchParams.set('blogId', blogId)
  url.searchParams.set('start', start)
  url.searchParams.set('end', end)
  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-Mc-Auth': userToken },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { blogId, reach: 0, ok: false }
    return { blogId, reach: sumPostReach(await res.json()), ok: true }
  } catch {
    return { blogId, reach: 0, ok: false } // one slow/broken account never breaks the total
  }
}

export interface ReachDiagnostic {
  /** Metricool team token + userId present in the environment. */
  configured: boolean
  /** How many clients have a metricool_blog_id set. */
  clientsWithBlog: number
  /** Per-account reach + whether the Metricool call succeeded. */
  perBlog: { blogId: string; reach: number; ok: boolean }[]
  /** Summed reach, or null when there's no real data to show. */
  total: number | null
}

/** The real computation, shared by the cached counter and the diagnostic. */
async function gatherReach(): Promise<ReachDiagnostic> {
  const userToken = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!userToken || !userId) {
    return { configured: false, clientsWithBlog: 0, perBlog: [], total: null }
  }

  try {
    const sb = admin()
    const { data } = await sb
      .from('clients')
      .select('metricool_blog_id')
      .not('metricool_blog_id', 'is', null)

    const blogIds = Array.from(
      new Set((data ?? []).map((r) => r.metricool_blog_id).filter(Boolean).map(String)),
    )
    if (blogIds.length === 0) {
      return { configured: true, clientsWithBlog: 0, perBlog: [], total: null }
    }

    const end = ymd(new Date())
    const start = ymd(new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000))

    const perBlog = await Promise.all(blogIds.map((id) => blogReach(userToken, userId, id, start, end)))
    const total = perBlog.reduce((a, b) => a + b.reach, 0)
    return { configured: true, clientsWithBlog: blogIds.length, perBlog, total: total > 0 ? total : null }
  } catch {
    return { configured: true, clientsWithBlog: 0, perBlog: [], total: null }
  }
}

async function computeAgencyReach(): Promise<number | null> {
  return (await gatherReach()).total
}

/** Cached once per day. Returns null if Metricool isn't configured or errors. */
export const getAgencyReach = unstable_cache(computeAgencyReach, ['agency-reach-v1'], {
  revalidate: 86400,
})

/**
 * Uncached, detailed snapshot for the owner-only diagnostic endpoint — so the
 * team can tell whether the login counter is showing real Metricool data or
 * falling back to nothing, and why.
 */
export async function getReachDiagnostic(): Promise<ReachDiagnostic> {
  return gatherReach()
}
