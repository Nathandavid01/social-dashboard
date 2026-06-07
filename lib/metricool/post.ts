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
  },
): Promise<MetricoolDraftResponse> {
  const config = getServerConfig()
  if (!config) throw new Error('Metricool server credentials not configured')

  const effectiveBlogId = blogId || config.blogId

  const providers = (platforms && platforms.length > 0 ? platforms : ['instagram', 'facebook', 'tiktok'])
    .map((p) => ({ network: p.toLowerCase() }))

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

  const res = await fetch(url.toString(), {
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
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Metricool API error: ${res.status} - ${text}`)
  }

  return res.json() as Promise<MetricoolDraftResponse>
}

export { getServerConfig }
