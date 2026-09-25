import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import { getAllSimpleProfiles } from '@/lib/metricool/client'
import { matchMetricoolBlogId } from '@/lib/recibo/metricool-profile'
import { reciboBoardIdeas, type ReciboQueueIdea } from '@/lib/recibo/board-ideas'
import { matchReciboPublished, measurableMedia, type ReciboPublishedMatch } from '@/lib/recibo/match-published'
import { logIdeaActivity } from '@/lib/utils/idea-activity'

export type ReciboPublishedSyncResult = {
  /** Recibo cuts linked to their Metricool post in this run. */
  linked: number
  error?: string
}

type CandidateIdea = Omit<ReciboQueueIdea, 'client' | 'videos'> & {
  client?: { status?: string | null; name?: string | null; metricool_blog_id?: string | null } | null
  videos?: (NonNullable<ReciboQueueIdea['videos']>[number] & { size_bytes?: number | null; uploaded_at?: string | null })[] | null
}

const DAY = 24 * 60 * 60 * 1000
/** Before the first cut was uploaded nothing could have been posted; a margin covers re-registered files. */
const LOOKBACK_DAYS = 14
const LOOKAHEAD_DAYS = 90

// Metricool media URLs are immutable: a size measured once stays true.
const sizeCache = new Map<string, number>()

async function mediaSize(url: string): Promise<number | undefined> {
  const cached = sizeCache.get(url)
  if (cached !== undefined) return cached
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(5_000) })
    const size = Number(res.headers.get('content-length'))
    if (!res.ok || !Number.isFinite(size) || size <= 0) return undefined
    sizeCache.set(url, size)
    return size
  } catch {
    return undefined
  }
}

/**
 * Links each Recibo cut that the team already posted or scheduled by hand in
 * Metricool to that post (metricool_post_id / uuid / posted_at). From then on
 * the whole existing machinery applies: Recibo drops it as agendado, and
 * runMetricoolPublishedSync flips it to 'publicada' once it's live everywhere.
 * Writes only rows still unlinked, so it never overrides a dashboard send.
 */
export async function runReciboPublishedMatch(): Promise<ReciboPublishedSyncResult> {
  const base = getServerConfig()
  if (!base) return { linked: 0, error: 'Metricool no está configurado.' }
  const supabase = createAdminClient()
  if (!supabase) return { linked: 0, error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }

  const [{ data: aiClients, error: clientsErr }, { data: rows, error: ideasErr }] = await Promise.all([
    supabase.from('clients').select('id').eq('status', 'active').eq('edit_mode', 'ai'),
    supabase
      .from('content_ideas')
      .select(
        'id, client_id, status, published_at, manual_posted_status, metricool_post_id, posted_at, staff_client_approval, client_review_status, client:clients!content_ideas_client_id_fkey(status, name, metricool_blog_id), videos:content_idea_videos!content_idea_videos_idea_id_fkey(kind, status, storage_provider, uploaded_by, uploaded_at, size_bytes)',
      )
      .not('status', 'in', '(descartada,publicada)')
      .is('metricool_post_id', null)
      .is('posted_at', null)
      .is('published_at', null),
  ])
  if (clientsErr || ideasErr) return { linked: 0, error: (clientsErr ?? ideasErr)?.message }

  const board = reciboBoardIdeas((rows ?? []) as CandidateIdea[], (aiClients ?? []).map((c) => c.id as string))
  if (board.length === 0) return { linked: 0 }

  const byClient = new Map<string, CandidateIdea[]>()
  for (const idea of board) {
    const list = byClient.get(idea.client_id)
    if (list) list.push(idea)
    else byClient.set(idea.client_id, [idea])
  }

  const needsProfiles = [...byClient.values()].some((ideas) => !ideas[0].client?.metricool_blog_id?.trim())
  const profiles = needsProfiles ? await getAllSimpleProfiles(base.userToken, base.userId).catch(() => []) : []
  const now = Date.now()
  const end = new Date(now + LOOKAHEAD_DAYS * DAY).toISOString().slice(0, 19)

  const perClient = await Promise.allSettled(
    [...byClient.values()].map(async (ideas) => {
      const client = ideas[0].client
      const blogId = client?.metricool_blog_id?.trim() || matchMetricoolBlogId(client?.name ?? '', profiles)
      if (!blogId) return []
      const firstUpload = Math.min(
        ...ideas.flatMap((idea) => (idea.videos ?? []).map((v) => Date.parse(v.uploaded_at ?? '') || now)),
      )
      const start = new Date(firstUpload - LOOKBACK_DAYS * DAY).toISOString().slice(0, 19)
      const posts = await getScheduledPosts({ ...base, blogId }, start, end)
      const urls = measurableMedia(posts)
      const measured = new Map(await Promise.all(urls.map(async (url) => [url, await mediaSize(url)] as const)))
      return matchReciboPublished(ideas, posts, (url) => measured.get(url))
    }),
  )
  const failed = perClient.filter((r) => r.status === 'rejected').length
  let matches: ReciboPublishedMatch[] = perClient.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

  // A post that already belongs to another idea (same file registered twice) is not this cut's.
  if (matches.length > 0) {
    const { data: taken } = await supabase
      .from('content_ideas')
      .select('metricool_post_id')
      .in('metricool_post_id', matches.map((m) => m.postId))
    const takenIds = new Set((taken ?? []).map((row) => row.metricool_post_id as number))
    matches = matches.filter((m) => !takenIds.has(m.postId))
  }

  const clientOf = new Map(board.map((idea) => [idea.id, idea.client_id]))
  let linked = 0
  for (const match of matches) {
    const { data: saved } = await supabase
      .from('content_ideas')
      .update({
        metricool_post_id: match.postId,
        metricool_uuid: match.uuid,
        posted_at: new Date().toISOString(),
        ...(match.publishDate ? { publish_date: match.publishDate } : {}),
        posting_error: null,
      })
      .eq('id', match.ideaId)
      .is('metricool_post_id', null)
      .is('posted_at', null)
      .select('id')
      .maybeSingle()
    if (!saved) continue
    linked += 1
    await logIdeaActivity(supabase, {
      ideaId: match.ideaId,
      action: 'posted_to_metricool',
      clientId: clientOf.get(match.ideaId) ?? null,
      userId: null,
      metadata: { source: 'metricool_match', metricoolPostId: match.postId },
    })
  }

  return failed ? { linked, error: `Metricool no respondió para ${failed} cliente(s).` } : { linked }
}
