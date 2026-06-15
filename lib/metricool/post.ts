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
 * Maps an idea `content_type` (R/P/C/S) to the per-network publish FORMAT so the
 * post shows up on the social network as the SAME kind the idea was planned as.
 * Returns the `*Data` objects Metricool uses to pick the format, scoped to the
 * networks the post actually targets (`instagramData`/`facebookData.type` accept
 * POST | REEL | STORY per Metricool's API):
 *   - R (Reel)     → IG `{ type: 'REEL', showReelOnFeed: true }`, FB `{ type: 'REEL' }`
 *   - S (Story)    → IG/FB `{ type: 'STORY' }`
 *   - P (Post)     → IG/FB `{ type: 'POST' }` (plain feed post)
 *   - C (Carousel) → IG/FB `{ type: 'POST' }` (a carousel is a POST with >1 media)
 *   - TikTok: videos are native; there's no format flag, so nothing is added.
 *
 * An unknown/null content_type returns `{}` (no override) — backwards compatible.
 */
const CONTENT_TYPE_TO_FORMAT: Record<string, 'REEL' | 'STORY' | 'POST'> = {
  R: 'REEL',
  S: 'STORY',
  P: 'POST',
  C: 'POST',
}

export function postFormatData(
  contentType: string | null | undefined,
  platforms: string[],
): Record<string, unknown> {
  const format = contentType ? CONTENT_TYPE_TO_FORMAT[contentType] : undefined
  if (!format) return {}
  const networks = new Set(platforms.map((p) => p.toLowerCase()))
  const data: Record<string, unknown> = {}
  if (networks.has('instagram')) {
    // Instagram only publishes single videos as Reels via the API; showReelOnFeed
    // surfaces the Reel on the grid too.
    data.instagramData = format === 'REEL' ? { type: 'REEL', showReelOnFeed: true } : { type: format }
  }
  if (networks.has('facebook')) data.facebookData = { type: format }
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
    /** Idea content_type (R/P/C/S). Drives the per-network publish format so the
     *  post matches the planned type (Reel/Story/Post/Carousel) on the network. */
    contentType?: string | null
  },
): Promise<MetricoolDraftResponse> {
  const config = getServerConfig()
  if (!config) throw new Error('Metricool server credentials not configured')

  const effectiveBlogId = blogId || config.blogId

  const networks = (platforms && platforms.length > 0 ? platforms : ['instagram', 'facebook', 'tiktok'])
    .map((p) => p.toLowerCase())
  const providers = networks.map((network) => ({ network }))
  const formatData = postFormatData(opts?.contentType, networks)

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

  const send = (includeFormat: boolean) =>
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
        ...(includeFormat ? formatData : {}),
      }),
    })

  const hasFormatHints = Object.keys(formatData).length > 0
  let res = await send(hasFormatHints)
  // The format hints are best-effort: if Metricool rejects them (some accounts/
  // networks don't accept a format override via the API), never let that block
  // the publish — retry once without the format override.
  if (!res.ok && hasFormatHints) {
    res = await send(false)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Metricool API error: ${res.status} - ${text}`)
  }

  return res.json() as Promise<MetricoolDraftResponse>
}

export { getServerConfig }
