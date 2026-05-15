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
  platforms?: string[]
): Promise<MetricoolDraftResponse> {
  const config = getServerConfig()
  if (!config) throw new Error('Metricool server credentials not configured')

  const effectiveBlogId = blogId || config.blogId

  const providers = (platforms && platforms.length > 0 ? platforms : ['instagram', 'facebook', 'tiktok'])
    .map((p) => ({ network: p.toLowerCase() }))

  const publicationDate = {
    dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19),
    timezone: 'America/Puerto_Rico',
  }

  const url = new URL(`${METRICOOL_BASE}/v2/scheduler/posts`)
  url.searchParams.set('userId', config.userId)
  url.searchParams.set('blogId', effectiveBlogId)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'X-Mc-Auth': config.userToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: caption,
      draft: true,
      providers,
      publicationDate,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Metricool API error: ${res.status} - ${text}`)
  }

  return res.json() as Promise<MetricoolDraftResponse>
}

export { getServerConfig }
