'use server'

import { currentUserHas } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { signCoverUrls } from '@/lib/integrations/r2-cover-urls'
import { buildClientDetail, type DetailIdea, type DetailPost } from '@/lib/inventario/client-detail-core'
import type { ClientStockDetail } from '@/lib/inventario/client-detail-types'
import { proxiedClientLogo } from '@/lib/inventario/client-logo-url'
import { cadenceFormats } from '@/lib/inventario/cadence-formats'
import { metricoolPictures } from '@/lib/inventario/load-video-stock'
import { loadPlannerSlots } from '@/lib/inventario/load-scheduled'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POST_TZ } from '@/lib/utils/idea-lab-send-core'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Covers signed per open profile — the panel never shows more than this. */
const MAX_POSTS = 12
const RECENT_SLOTS = 3

/**
 * Client profile for /inventario: who they are, the next 14 days of their
 * calendar, and the posts behind it (with covers). Gated like the page.
 */
export async function getClientStockDetail(
  clientId: string,
): Promise<{ detail: ClientStockDetail } | { error: string }> {
  if (!(await currentUserHas('video_stock.read'))) return { error: 'No autorizado' }
  if (!UUID.test(clientId)) return { error: 'Cliente inválido' }

  const supabase = await createClient()
  const today = todayISOInTimeZone(POST_TZ)
  const [{ data: client, error: clientError }, { data: ideas, error: ideasError }, pictures, { data: schedules }, planner] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle(),
    supabase
      .from('content_ideas')
      .select(
        'id, title, status, content_type, publish_date, published_at, manual_posted_status, metricool_post_id, posted_at, ' +
          // Always the idea→videos FK (CLAUDE.md: a bare embed hits PGRST201).
          'videos:content_idea_videos!content_idea_videos_idea_id_fkey(id, kind, status, uploaded_at)',
      )
      .eq('client_id', clientId)
      .neq('status', 'descartada')
      .order('created_at', { ascending: true })
      .limit(1000),
    metricoolPictures().catch(() => ({}) as Record<string, string>),
    // Reel/post per weekday; a read error only loses the split, not the profile.
    supabase.from('production_schedules').select('day_of_week, content_type').eq('client_id', clientId),
    loadPlannerSlots(today).catch(() => null),
  ])
  if (clientError || ideasError) return { error: 'No se pudo leer el cliente' }
  if (!client) return { error: 'Cliente no encontrado' }

  let editorName: string | null = null
  if (client.assigned_to) {
    const { data: editor } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', client.assigned_to)
      .maybeSingle()
    editorName = editor?.full_name?.trim() || editor?.email || null
  }

  const postingDays = (client.posting_days as number[] | null) ?? []
  const formats = Object.fromEntries(
    cadenceFormats(postingDays, client.posting_schedule as Record<string, string> | null, schedules ?? []),
  )
  const detail = buildClientDetail((ideas ?? []) as unknown as DetailIdea[], postingDays, today, formats, planner?.[clientId] ?? [])

  // Always leave room for what just went out, so a full queue never reads as
  // "nothing published lately".
  const recent = detail.recent.slice(0, Math.max(RECENT_SLOTS, MAX_POSTS - detail.upcoming.length))
  const upcoming = detail.upcoming.slice(0, MAX_POSTS - recent.length)
  const coverIds = [...upcoming, ...recent].map((p) => p.coverVideoId).filter((id): id is string => !!id)
  const { urls = {} } = coverIds.length > 0 ? await signCoverUrls(coverIds) : { urls: {} }
  const withCover = (p: DetailPost) => ({ ...p, coverUrl: p.coverVideoId ? urls[p.coverVideoId] ?? null : null })

  return {
    detail: {
      profile: {
        id: client.id,
        name: client.name,
        logoUrl: proxiedClientLogo(client, pictures),
        postingDays,
        postingTime: (client.posting_time as string | null) ?? null,
        editorName,
        formats,
        postingSchedule: (client.posting_schedule as Record<string, string> | null) ?? {},
        postingTimezone: (client.posting_timezone as string | null) ?? null,
      },
      calendar: detail.calendar,
      upcoming: upcoming.map(withCover),
      recent: recent.map(withCover),
      crudo: detail.crudo,
    },
  }
}
