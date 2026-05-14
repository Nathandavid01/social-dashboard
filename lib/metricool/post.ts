const METRICOOL_BASE = 'https://app.metricool.com/api'

export interface MetricoolServerConfig {
  userToken: string
  userId: string
  blogId: string
}

export interface CreateDraftPost {
  text: string
  blogId: string
  userId: string
}

export interface MetricoolDraftResponse {
  id?: number
  uuid?: string
  [key: string]: unknown
}

function getServerConfig(): MetricoolServerConfig | null {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  const blogId = process.env.METRICOOL_BLOG_ID
  if (!token || !userId || !blogId) return null
  return { userToken: token, userId, blogId }
}

async function metricoolPost<T>(
  endpoint: string,
  config: MetricoolServerConfig,
  body: Record<string, unknown>
): Promise<T> {
  const url = new URL(`${METRICOOL_BASE}${endpoint}`)
  url.searchParams.set('userId', config.userId)
  url.searchParams.set('blogId', config.blogId)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'X-Mc-Auth': config.userToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Metricool API error: ${res.status} - ${text}`)
  }

  return res.json() as Promise<T>
}

export async function createDraftPost(
  caption: string,
  blogId?: string
): Promise<MetricoolDraftResponse> {
  const config = getServerConfig()
  if (!config) throw new Error('Metricool server credentials not configured')

  const effectiveBlogId = blogId || config.blogId

  return metricoolPost<MetricoolDraftResponse>(
    '/v2/scheduler/post',
    { ...config, blogId: effectiveBlogId },
    {
      text: caption,
      draft: true,
      blogId: Number(effectiveBlogId),
    }
  )
}

export { getServerConfig }
