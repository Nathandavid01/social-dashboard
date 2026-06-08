const METRICOOL_BASE = 'https://app.metricool.com/api'

export interface MetricoolServerConfig {
  userToken: string
  userId: string
  blogId: string
}

export interface MetricoolDraftResponse {
  data?: {
    id?: number
    uuid?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

function getServerConfig(): MetricoolServerConfig | null {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  const blogId = process.env.METRICOOL_BLOG_ID
  if (!token || !userId || !blogId) return null
  return { userToken: token, userId, blogId }
}

/**
 * Per-network "post as a Reel" hints for a Metricool scheduler post.
 *
 * Only applies to Reel ideas (`content_type === 'R'`). Returns the `*Data`
 * objects Metricool uses to pick the publish FORMAT, scoped to the networks the
 * post actually targets:
 *   - Facebook: `facebookData.type = 'REEL'` makes it a Reel instead of a plain
 *     video post (confirmed by Metricool's API docs — type is POST | REEL).
 *   - Instagram: `instagramData.type = 'REEL'` + `showReelOnFeed` (Instagram only
 *     publishes single videos as Reels via the API, so this is the natural shape).
 *   - TikTok: videos are native; there is no Reel flag, so nothing is added.
 *
 * Anything non-Reel (Post/Carousel/Story) returns `{}` — no format override.
 */
export function reelFormatData(
  contentType: string | null | undefined,
  platforms: string[],
): Record<string, unknown> {
  if (contentType !== 'R') return {}
  const networks = new Set(platforms.map((p) => p.toLowerCase()))
  const data: Record<string, unknown> = {}
  if (networks.has('instagram')) data.instagramData = { type: 'REEL', showReelOnFeed: true }
  if (networks.has('facebook')) data.facebookData = { type: 'REEL' }
  return data
}

export async function createDraftPost(
  caption: string,
  blogId?: string,
  platforms?: string[],
  driveLink?: string,
  scheduledFor?: string,  // ISO datetime — defaults to 24h from now
  opts?: {
    /** Public media URLs to ATTACH to the post (e.g. the edited video). */
    mediaUrls?: string[]
    /** When true, schedule a REAL post (draft:false + autoPublish) that goes
     *  live by itself at publicationDate; otherwise create a draft to finalize. */
    autoPublish?: boolean
    /** Idea content_type ('R' = Reel). Drives the per-network Reel format hints. */
    contentType?: string | null
  },
): Promise<MetricoolDraftResponse> {
  const config = getServerConfig()
  if (!config) throw new Error('Metricool server credentials not configured')

  const effectiveBlogId = blogId || config.blogId

  const networks = (platforms && platforms.length > 0 ? platforms : ['instagram', 'facebook', 'tiktok'])
    .map((p) => p.toLowerCase())
  const providers = networks.map((network) => ({ network }))
  const reelData = reelFormatData(opts?.contentType, networks)

  // Metricool wants a naive local datetime + a timezone (it publishes at that
  // wall-clock in `timezone`). Pass a planned naive datetime ("YYYY-MM-DDTHH:MM")
  // through UNCHANGED so the scheduled hour is honored regardless of the server's
  // timezone; anything with a Z/offset is normalized via Date (legacy callers).
  const isNaiveLocal = !!scheduledFor && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(scheduledFor)
  const dateTime = scheduledFor
    ? (isNaiveLocal ? `${scheduledFor}:00`.slice(0, 19) : new Date(scheduledFor).toISOString().slice(0, 19))
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19)

  const publicationDate = {
    dateTime,
    timezone: 'America/Puerto_Rico',
  }

  const mediaUrls = opts?.mediaUrls?.filter(Boolean) ?? []
  const autoPublish = opts?.autoPublish === true

  const url = new URL(`${METRICOOL_BASE}/v2/scheduler/posts`)
  url.searchParams.set('userId', config.userId)
  url.searchParams.set('blogId', effectiveBlogId)

  const send = (includeReel: boolean) =>
    fetch(url.toString(), {
      method: 'POST',
      signal: AbortSignal.timeout(15_000), // bound the round-trip so a hung Metricool can't block approval
      headers: {
        'X-Mc-Auth': config.userToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: caption,
        draft: !autoPublish,
        ...(autoPublish ? { autoPublish: true } : {}),
        providers,
        publicationDate,
        ...(mediaUrls.length > 0 ? { media: mediaUrls } : {}),
        ...(driveLink ? { firstCommentText: driveLink } : {}),
        ...(includeReel ? reelData : {}),
      }),
    })

  const hasReelHints = Object.keys(reelData).length > 0
  let res = await send(hasReelHints)
  // The Reel format hints are best-effort: if Metricool rejects them (some
  // accounts/networks don't accept a format override via the API), never let
  // that block the publish — retry once as a plain video post.
  if (!res.ok && hasReelHints) {
    res = await send(false)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Metricool API error: ${res.status} - ${text}`)
  }

  return res.json() as Promise<MetricoolDraftResponse>
}

export { getServerConfig }
