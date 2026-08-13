/**
 * Pure helpers for auto-posting an idea to Metricool. Kept out of the
 * `'use server'` action so the readiness/scheduling logic is unit-testable
 * without mocking Supabase/Metricool.
 */

export interface PostableIdea {
  approval_status: string | null
  generated_caption: string | null
  status: string | null
  published_at: string | null
  /** Set once we've posted — the idempotency guard. */
  metricool_post_id: number | null
  /** Backstop guard: set on success even if Metricool returned no post id. */
  posted_at: string | null
}

export interface PostReadiness {
  ready: boolean
  reason?: string
}

/**
 * An idea is postable once it is approved, has a caption and an edited video,
 * has not been posted before (idempotency), isn't already published, AND its
 * client has a Metricool blog id. Order matters: the idempotency guard is
 * checked first so we never re-post.
 *
 * The blog-id requirement is a SAFETY gate for auto-publish: without it the
 * post would fall back to the global default Metricool account — i.e. publish a
 * real post to the WRONG (agency) feed. So we refuse rather than guess.
 */
export function ideaPostReadiness(
  idea: PostableIdea,
  hasEditedVideo: boolean,
  metricoolBlogId: string | null | undefined,
): PostReadiness {
  if (idea.metricool_post_id != null) return { ready: false, reason: 'Ya se publicó en Metricool' }
  // posted_at is the backstop: a successful post whose Metricool id never came
  // back (or whose bookkeeping partially failed) must still never re-post.
  if (idea.posted_at) return { ready: false, reason: 'Ya se publicó en Metricool' }
  if (idea.published_at || idea.status === 'publicada') return { ready: false, reason: 'El video ya está publicado' }
  if (idea.approval_status !== 'approved') return { ready: false, reason: 'El video no está aprobado' }
  if (!idea.generated_caption || idea.generated_caption.trim().length === 0) return { ready: false, reason: 'Falta el caption' }
  if (!hasEditedVideo) return { ready: false, reason: 'Falta el video editado' }
  if (!metricoolBlogId || metricoolBlogId.trim().length === 0) {
    return { ready: false, reason: 'El cliente no tiene Metricool configurado (falta blog_id)' }
  }
  return { ready: true }
}

function normalizeTime(t?: string | null): string | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  if (!m) return null
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, '0')
  return `${hh}:${m[2]}`
}

/**
 * The datetime to schedule the post at. Publishes on the idea's PLANNED
 * `publish_date` at the client's `posting_time` (defaults to 10:00). If no
 * planned date exists, falls back to +24h from `nowMs`.
 * Returns a naive "YYYY-MM-DDTHH:MM:SS" string (interpreted by Metricool in the
 * post's timezone — America/Puerto_Rico).
 */
export function buildPublishDateTime(
  publishDate: string | null | undefined,
  postingTime: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  // Only schedule on the planned date if it's today or in the future. A PAST
  // planned date (approving an overdue idea) would otherwise produce a past
  // publicationDate — which an auto-publish could fire IMMEDIATELY. Clamp those
  // to +24h so an overdue approval can't blast the video live on the spot.
  const todayUtc = new Date(nowMs).toISOString().slice(0, 10)
  if (publishDate && publishDate >= todayUtc) {
    const time = normalizeTime(postingTime) ?? '10:00'
    return `${publishDate}T${time}:00`
  }
  return new Date(nowMs + 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
}

export type PublishableEditedVideo = {
  id: string
  drive_file_id: string | null
  storage_provider: string | null
  kind?: string | null
  status?: string | null
  uploaded_at?: string | null
  /** When present, a file from another idea (last week, same client) is dropped. */
  idea_id?: string | null
}

/** Where the human watched the video they are approving. */
export type VideoWatchBoard = 'entregas' | 'pipeline'

function isLiveEdited(v: PublishableEditedVideo, ideaId?: string | null): boolean {
  if (!v) return false
  if ((v.kind ?? 'edited') !== 'edited') return false
  if (v.status === 'archived') return false
  if (!v.drive_file_id) return false
  if (v.storage_provider !== 'r2' && v.storage_provider !== 'entregas-r2') return false
  if (ideaId && v.idea_id && v.idea_id !== ideaId) return false
  return true
}

/**
 * Board-agnostic edges (staff approve, generic publish) must not force
 * pipeline. If this idea has a live Entregas cut, that is the file.
 */
export function inferWatchBoard(
  videos: PublishableEditedVideo[],
  ideaId?: string | null,
): VideoWatchBoard | null {
  const live = videos.filter((v) => isLiveEdited(v, ideaId))
  if (live.some((v) => v.storage_provider === 'entregas-r2')) return 'entregas'
  if (live.some((v) => v.storage_provider === 'r2')) return 'pipeline'
  return null
}

/**
 * The file Metricool must receive: the one being approved, never another
 * idea of the same client and never the other board's leftover cut.
 */
export function pickEditedVideoForPublish(
  videos: PublishableEditedVideo[],
  opts?: {
    preferredId?: string | null
    ideaId?: string | null
    watchedOn?: VideoWatchBoard | null
  },
): PublishableEditedVideo | null {
  const ideaId = opts?.ideaId?.trim() || null
  const live = videos.filter((v) => isLiveEdited(v, ideaId))
  if (live.length === 0) return null

  if (opts?.preferredId) {
    const preferred = live.find((v) => v.id === opts.preferredId)
    if (preferred) return preferred
  }

  const newest = (list: PublishableEditedVideo[]) =>
    [...list].sort((a, b) => ((a.uploaded_at ?? '') < (b.uploaded_at ?? '') ? 1 : -1))[0] ?? null

  const board = opts?.watchedOn ?? inferWatchBoard(live, ideaId)
  const onBoard = board
    ? live.filter((v) => v.storage_provider === (board === 'entregas' ? 'entregas-r2' : 'r2'))
    : null
  if (onBoard && onBoard.length > 0) return newest(onBoard)

  const entregas = live.filter((v) => v.storage_provider === 'entregas-r2')
  if (entregas.length > 0) return newest(entregas)
  return newest(live)
}

/** Networks to post to: the client's own platforms, else its defaults, else IG/FB/TikTok. */
export function resolvePlatforms(
  clientPlatforms?: string[] | null,
  defaultPlatforms?: string[] | null,
): string[] {
  const src =
    clientPlatforms && clientPlatforms.length > 0
      ? clientPlatforms
      : defaultPlatforms && defaultPlatforms.length > 0
        ? defaultPlatforms
        : ['instagram', 'facebook', 'tiktok']
  return src.map((p) => p.toLowerCase())
}
