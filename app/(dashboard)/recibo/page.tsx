import { requirePermission } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { reciboBoardIdeas } from '@/lib/recibo/board-ideas'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POSTING_TZ } from '@/lib/utils/publish-override'
import { canSeeReciboUploadCounts } from '@/lib/recibo/upload-counts'
import { ReciboBoard } from '@/components/recibo/recibo-board'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Recibo — videos waiting for approval, or approved and still waiting
 * to be posted or scheduled in Metricool. No Metricool auto-post.
 */
export default async function ReciboPage() {
  await requirePermission('entregas.read')

  const supabase = await createClient()
  const [ideas, aiClientsRes] = await Promise.all([
    getIdeacionPipeline({ complete: true }),
    supabase
      .from('clients')
      .select('id, name, logo_url, edit_mode')
      .eq('status', 'active')
      .eq('edit_mode', 'ai')
      .order('name'),
  ])

  let aiClients = (aiClientsRes.data ?? []) as { id: string; name: string; logo_url?: string | null; edit_mode?: string }[]
  if (aiClientsRes.error && /edit_mode/i.test(aiClientsRes.error.message ?? '')) {
    aiClients = []
  }

  const boardIdeas = await withUploaderNames(supabase, reciboBoardIdeas(ideas, aiClients.map((client) => client.id)))
  const shownClientIds = [...new Set(boardIdeas.map((idea) => idea.client_id))]
  const boardClients = aiClients.filter((client) => shownClientIds.includes(client.id))
  const ideaIds = boardIdeas.map((idea) => idea.id)
  const [{ data: sentRows }, { data: cadenceRows }] = await Promise.all([
    ideaIds.length
      ? supabase.from('entregas_client_review_items').select('idea_id').in('idea_id', ideaIds)
      : Promise.resolve({ data: [] as { idea_id: string }[] }),
    shownClientIds.length
      ? supabase.from('clients').select('id, posting_days, posting_time, posting_schedule, metricool_blog_id').in('id', shownClientIds)
      : Promise.resolve({ data: [] as { id: string; posting_days: number[] | null; posting_time: string | null; posting_schedule: Record<string, string> | null; metricool_blog_id: string | null }[] }),
  ])
  const cadenceByClient = Object.fromEntries((cadenceRows ?? []).map((client) => [client.id, {
    postingDays: client.posting_days,
    postingTime: client.posting_time,
    postingSchedule: client.posting_schedule,
    metricool: Boolean(client.metricool_blog_id?.trim()),
  }]))
  const { data: auth } = await supabase.auth.getUser()
  const viewer = auth.user
  let viewerName: string | null = null
  if (viewer) {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', viewer.id).maybeSingle()
    viewerName = profile?.full_name ?? null
  }

  // Padding comes from dashboard layout — keep this wrapper lean for mobile width.
  return (
    <ReciboBoard
      ideas={boardIdeas}
      aiClients={boardClients}
      sentIdeaIds={(sentRows ?? []).map((row) => row.idea_id)}
      cadenceByClient={cadenceByClient}
      todayISO={todayISOInTimeZone(POSTING_TZ)}
      showUploadCounts={canSeeReciboUploadCounts({ id: viewer?.id, fullName: viewerName })}
    />
  )
}

async function withUploaderNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ideas: IdeaWithPipeline[],
): Promise<IdeaWithPipeline[]> {
  const ids = [...new Set(ideas.flatMap((idea) => (idea.videos ?? []).map((video) => video.uploaded_by).filter((id): id is string => Boolean(id))))]
  if (ids.length === 0) return ideas
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids)
  const names = new Map((data ?? []).map((profile) => [profile.id, profile.full_name]))
  return ideas.map((idea) => ({
    ...idea,
    videos: (idea.videos ?? []).map((video) => ({
      ...video,
      uploader: video.uploaded_by
        ? { id: video.uploaded_by, full_name: names.get(video.uploaded_by) ?? null, email: '' }
        : video.uploader ?? null,
    })),
  }))
}
