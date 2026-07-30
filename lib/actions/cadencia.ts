'use server'

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/server'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import {
  buildCadencia,
  buildConfirmation,
  weekDaysMon,
  type CadenciaData,
  type CadenciaClientInput,
} from '@/lib/utils/cadencia'
import type { SocialPlatform } from '@/lib/supabase/types'

// Clients to keep out of the cadence overview (Nathan's call). Matched on the
// trimmed, lowercased client name.
const EXCLUDED_CLIENT_NAMES = ['primer round oficial']

interface ClientRow {
  id: string
  name: string
  posting_time: string | null
  posting_days: number[] | null
  platforms: SocialPlatform[] | null
  metricool_blog_id: string | null
}

/**
 * Build the home "Cadencia" widget model. Cadence reality comes from Metricool
 * (what actually went live this week), measured against each client's configured
 * cadence (`posting_days` = the meta). The production calendar is NOT consulted.
 *
 * Returns an empty week (not a 500) if the user lacks permission, so the home
 * page degrades gracefully.
 */
export async function getCadenciaData(): Promise<CadenciaData> {
  const now = new Date()
  const days = weekDaysMon(now)
  const today = toLocalDate(now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  try {
    await requirePermission('cadence.read')
  } catch {
    return buildCadencia([], days, today, nowMinutes)
  }

  const clients = await sweepWeek(days[0], days[6])
  return buildCadencia(clients, days, today, nowMinutes)
}

/**
 * Cached Metricool sweep, keyed by the week's Monday. Service-level (same for
 * every viewer), so it runs with the admin client and is shared via the Next
 * data cache for 10 min — avoids one Metricool call per client on every render.
 */
function sweepWeek(weekStart: string, weekEnd: string): Promise<CadenciaClientInput[]> {
  // Bump the version segment whenever the cached shape changes, to evict stale entries.
  return unstable_cache(() => sweepWeekUncached(weekStart, weekEnd), ['cadencia-sweep', 'v2', weekStart], {
    revalidate: 600,
  })()
}

async function sweepWeekUncached(weekStart: string, weekEnd: string): Promise<CadenciaClientInput[]> {
  const supabase = createAdminClient()
  const base = getServerConfig()
  if (!supabase || !base) return []

  const { data } = await supabase
    .from('clients')
    .select('id, name, posting_time, posting_days, platforms, metricool_blog_id')
    .eq('status', 'active')
    .not('metricool_blog_id', 'is', null)
    .order('name', { ascending: true })

  const rows = ((data ?? []) as ClientRow[]).filter(
    (c) => !EXCLUDED_CLIENT_NAMES.includes(c.name.trim().toLowerCase()),
  )

  const startStr = `${weekStart}T00:00:00`
  const endStr = `${weekEnd}T23:59:59`

  // Chunked concurrency (6 at a time) so we don't hammer Metricool — mirrors the
  // pattern in lib/actions/cadence.ts.
  const CHUNK = 6
  const out: CadenciaClientInput[] = []
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const results = await Promise.all(chunk.map((c) => fetchClientWeek(c, base, startStr, endStr, weekStart, weekEnd)))
    out.push(...results)
  }
  return out
}

async function fetchClientWeek(
  c: ClientRow,
  base: { userToken: string; userId: string; blogId: string },
  startStr: string,
  endStr: string,
  weekStart: string,
  weekEnd: string,
): Promise<CadenciaClientInput> {
  const input: CadenciaClientInput = {
    clientId: c.id,
    clientName: c.name,
    platforms: c.platforms ?? [],
    postingTime: c.posting_time,
    postingDays: c.posting_days ?? [],
    publishedDates: [],
    errorDates: [],
    pendingDates: [],
    liveUrlsByDate: {},
  }

  try {
    const posts = await getScheduledPosts({ ...base, blogId: c.metricool_blog_id! }, startStr, endStr)
    for (const p of posts) {
      const conf = buildConfirmation({ id: p.id, draft: p.draft, providers: p.providers ?? [] })
      if (!conf) continue // draft / no providers → not part of cadence yet
      const date = p.publicationDate?.dateTime?.slice(0, 10)
      if (!date || date < weekStart || date > weekEnd) continue
      if (conf.state === 'confirmed') {
        input.publishedDates.push(date)
        if (conf.url) (input.liveUrlsByDate[date] ??= []).push(conf.url)
      } else if (conf.state === 'failed') {
        input.errorDates.push(date)
      } else {
        input.pendingDates.push(date)
      }
    }
  } catch {
    // Best-effort: a client whose Metricool call fails just shows no data.
  }

  return input
}

/** YYYY-MM-DD in local time (matches the publish dates we compare against). */
function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
