import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts, type ScheduledPost } from '@/lib/metricool/scheduler'
import { getAllSimpleProfiles } from '@/lib/metricool/client'
import { publicationDay, publicationInstant } from '@/lib/metricool/publication-date'
import { matchMetricoolBlogId } from '@/lib/recibo/metricool-profile'
import { reciboBoardIdeas, usableCut, type ReciboQueueIdea } from '@/lib/recibo/board-ideas'
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
/** When no cut has an upload date. */
const FALLBACK_LOOKBACK_DAYS = 60
const LOOKAHEAD_DAYS = 90
const PAGE = 1000
const HEADS_AT_ONCE = 6

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

async function measureAll(urls: string[]): Promise<Map<string, number | undefined>> {
  const sizes = new Map<string, number | undefined>()
  let next = 0
  const worker = async () => {
    while (next < urls.length) {
      const url = urls[next++]
      sizes.set(url, await mediaSize(url))
    }
  }
  await Promise.all(Array.from({ length: Math.min(HEADS_AT_ONCE, urls.length) }, worker))
  return sizes
}

/** Unlinked, unpublished ideas that have an edited cut — every page, not just PostgREST's first 1000 rows. */
async function loadCandidates(supabase: SupabaseClient): Promise<{ rows: CandidateIdea[]; error?: string }> {
  const rows: CandidateIdea[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('content_ideas')
      .select(
        'id, client_id, status, published_at, manual_posted_status, metricool_post_id, posted_at, staff_client_approval, client_review_status, client:clients!content_ideas_client_id_fkey(status, name, metricool_blog_id), videos:content_idea_videos!content_idea_videos_idea_id_fkey!inner(kind, status, storage_provider, uploaded_by, uploaded_at, size_bytes)',
      )
      .not('status', 'in', '(descartada,publicada)')
      .is('metricool_post_id', null)
      .is('posted_at', null)
      .is('published_at', null)
      .eq('videos.kind', 'edited')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return { rows, error: error.message }
    rows.push(...((data ?? []) as CandidateIdea[]))
    if (!data || data.length < PAGE) return { rows }
  }
}

/** Oldest usable cut upload minus a margin — raw clips and archived cuts don't widen it. */
function windowStart(ideas: CandidateIdea[], now: number): string {
  const uploads = ideas
    .flatMap((idea) => (idea.videos ?? []).filter(usableCut).map((v) => Date.parse(v.uploaded_at ?? '')))
    .filter(Number.isFinite)
  const from = uploads.length ? Math.min(...uploads) - LOOKBACK_DAYS * DAY : now - FALLBACK_LOOKBACK_DAYS * DAY
  return new Date(from).toISOString().slice(0, 19)
}

/**
 * Links each Recibo cut that the team already posted or scheduled by hand in
 * Metricool to that post (metricool_post_id / uuid / posted_at). From then on
 * the whole existing machinery applies: Recibo drops it as agendado, and
 * runMetricoolPublishedSync flips it to 'publicada' once it's live everywhere.
 * Writes only rows still unlinked and with no send in flight, so it never
 * overrides a dashboard send.
 */
export async function runReciboPublishedMatch(): Promise<ReciboPublishedSyncResult> {
  const base = getServerConfig()
  if (!base) return { linked: 0, error: 'Metricool no está configurado.' }
  const supabase = createAdminClient()
  if (!supabase) return { linked: 0, error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }

  const [{ data: aiClients, error: clientsErr }, candidates] = await Promise.all([
    supabase.from('clients').select('id').eq('status', 'active').eq('edit_mode', 'ai'),
    loadCandidates(supabase),
  ])
  if (clientsErr || candidates.error) return { linked: 0, error: clientsErr?.message ?? candidates.error }

  const board = reciboBoardIdeas(candidates.rows, (aiClients ?? []).map((c) => c.id as string))
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
    [...byClient].map(async ([clientId, ideas]) => {
      const saved = ideas[0].client?.metricool_blog_id?.trim() || null
      const blogId = saved || matchMetricoolBlogId(ideas[0].client?.name ?? '', profiles)
      if (!blogId) return []
      const posts = await getScheduledPosts({ ...base, blogId }, windowStart(ideas, now), end)
      const sizes = await measureAll(measurableMedia(posts))
      const matches = matchReciboPublished(ideas, posts, (url) => sizes.get(url))
      // The daily sync only reads saved blog ids: a blog found by name must be
      // saved first — a byte-exact match proves it's this client's — or the
      // linked post would look "missing" every morning.
      if (matches.length > 0 && !saved && !(await saveBlogId(supabase, clientId, blogId))) return []
      return matches
    }),
  )
  const failed = perClient.filter((r) => r.status === 'rejected').length
  let matches = perClient.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

  // A post that already belongs to another idea (same file registered twice) is not this cut's.
  if (matches.length > 0) {
    const { data: taken } = await supabase
      .from('content_ideas')
      .select('metricool_post_id')
      .in('metricool_post_id', matches.map((m) => m.post.id))
    const takenIds = new Set((taken ?? []).map((row) => row.metricool_post_id as number))
    matches = matches.filter((m) => !takenIds.has(m.post.id))
  }

  const clientOf = new Map(board.map((idea) => [idea.id, idea.client_id]))
  let linked = 0
  for (const match of matches) {
    if (await linkIdea(supabase, match)) {
      linked += 1
      await logIdeaActivity(supabase, {
        ideaId: match.ideaId,
        action: 'posted_to_metricool',
        clientId: clientOf.get(match.ideaId) ?? null,
        userId: null,
        metadata: { source: 'metricool_match', metricoolPostId: match.post.id },
      })
    }
  }

  return failed ? { linked, error: `Metricool no respondió para ${failed} cliente(s).` } : { linked }
}

async function saveBlogId(supabase: SupabaseClient, clientId: string, blogId: string): Promise<boolean> {
  const { data } = await supabase
    .from('clients')
    .update({ metricool_blog_id: blogId })
    .eq('id', clientId)
    .or('metricool_blog_id.is.null,metricool_blog_id.eq.')
    .select('id')
  return (data ?? []).length > 0
}

async function linkIdea(supabase: SupabaseClient, { ideaId, post }: ReciboPublishedMatch<ScheduledPost>): Promise<boolean> {
  const publishDate = publicationDay(post.publicationDate)
  const { data } = await supabase
    .from('content_ideas')
    .update({
      metricool_post_id: post.id,
      metricool_uuid: post.uuid ?? null,
      // When the post went into Metricool — not when this match noticed it.
      posted_at: publicationInstant(post.creationDate) ?? publicationInstant(post.publicationDate) ?? new Date().toISOString(),
      ...(publishDate ? { publish_date: publishDate } : {}),
      posting_error: null,
    })
    .eq('id', ideaId)
    .is('metricool_post_id', null)
    .is('posted_at', null)
    .is('posting_started_at', null)
    .select('id')
    .maybeSingle()
  return !!data
}
