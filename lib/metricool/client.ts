const METRICOOL_BASE_URL = 'https://app.metricool.com/api'

export interface MetricoolConfig {
  userToken: string
  userId: string
  blogId: string
}

export interface PublicBlog {
  id: string
  name: string
  url?: string
  provider?: string
  picture?: string
  [key: string]: unknown
}

export interface PublicPost {
  id: string
  provider: string
  text: string
  date: string
  likes?: number
  comments?: number
  shares?: number
  impressions?: number
  reach?: number
  engagement?: number
  mediaUrl?: string
  [key: string]: unknown
}

export interface InstagramReel {
  id: string
  text: string
  date: string
  likes?: number
  comments?: number
  plays?: number
  reach?: number
  [key: string]: unknown
}

export interface FacebookPost {
  id: string
  text: string
  date: string
  likes?: number
  comments?: number
  shares?: number
  impressions?: number
  reach?: number
  [key: string]: unknown
}

export interface LinkedinPost {
  id: string
  text: string
  date: string
  likes?: number
  comments?: number
  shares?: number
  impressions?: number
  [key: string]: unknown
}

function getConfig(): MetricoolConfig | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('metricool_config')
  if (!stored) return null
  try {
    return JSON.parse(stored) as MetricoolConfig
  } catch {
    return null
  }
}

export function saveConfig(config: MetricoolConfig) {
  localStorage.setItem('metricool_config', JSON.stringify(config))
}

export function clearConfig() {
  localStorage.removeItem('metricool_config')
}

export function isConfigured(): boolean {
  const config = getConfig()
  return !!(config?.userToken && config?.userId && config?.blogId)
}

export function getStoredConfig(): MetricoolConfig | null {
  return getConfig()
}

async function metricoolFetch<T>(
  endpoint: string,
  config: MetricoolConfig,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${METRICOOL_BASE_URL}${endpoint}`)
  url.searchParams.set('userId', config.userId)
  url.searchParams.set('blogId', config.blogId)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const response = await fetch(url.toString(), {
    headers: {
      'X-Mc-Auth': config.userToken,
    },
  })

  if (!response.ok) {
    throw new Error(`Metricool API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

// --- API Methods ---

export async function getProfiles(config: MetricoolConfig): Promise<PublicBlog[]> {
  return metricoolFetch<PublicBlog[]>('/admin/simpleProfiles', config)
}

export async function getProfileSyncs(config: MetricoolConfig): Promise<Record<string, number>> {
  return metricoolFetch<Record<string, number>>('/profile/lastsyncs', config)
}

export async function getStatsValues(
  config: MetricoolConfig,
  category: string,
  date: string
): Promise<Record<string, number>> {
  return metricoolFetch<Record<string, number>>(`/stats/values/${category}`, config, { date })
}

export async function getStatsTimeline(
  config: MetricoolConfig,
  metric: string,
  start: string,
  end: string
): Promise<string[][]> {
  return metricoolFetch<string[][]>(`/stats/timeline/${metric}`, config, { start, end })
}

export async function getStatsAggregation(
  config: MetricoolConfig,
  category: string,
  start: string,
  end: string
): Promise<Record<string, number>> {
  return metricoolFetch<Record<string, number>>(`/stats/aggregations/${category}`, config, { start, end })
}

export async function getPosts(
  config: MetricoolConfig,
  start: string,
  end: string
): Promise<PublicPost[]> {
  return metricoolFetch<PublicPost[]>('/stats/posts', config, { start, end })
}

export async function getInstagramReels(
  config: MetricoolConfig,
  start: string,
  end: string,
  sortcolumn?: string
): Promise<InstagramReel[]> {
  const params: Record<string, string> = { start, end }
  if (sortcolumn) params.sortcolumn = sortcolumn
  return metricoolFetch<InstagramReel[]>('/stats/instagram/reels', config, params)
}

export async function getInstagramStories(
  config: MetricoolConfig,
  start: string,
  end: string,
  sortcolumn?: string
): Promise<unknown[]> {
  const params: Record<string, string> = { start, end }
  if (sortcolumn) params.sortcolumn = sortcolumn
  return metricoolFetch<unknown[]>('/stats/instagram/stories', config, params)
}

export async function getFacebookPosts(
  config: MetricoolConfig,
  start: string,
  end: string,
  sortcolumn?: string
): Promise<FacebookPost[]> {
  const params: Record<string, string> = { start, end }
  if (sortcolumn) params.sortcolumn = sortcolumn
  return metricoolFetch<FacebookPost[]>('/stats/facebook/posts', config, params)
}

export async function getLinkedinPosts(
  config: MetricoolConfig,
  start: string,
  end: string,
  sortcolumn?: string
): Promise<LinkedinPost[]> {
  const params: Record<string, string> = { start, end }
  if (sortcolumn) params.sortcolumn = sortcolumn
  return metricoolFetch<LinkedinPost[]>('/stats/linkedin/posts', config, params)
}

export async function getDemographics(
  config: MetricoolConfig,
  type: 'gender' | 'age' | 'country' | 'city',
  provider: 'facebook' | 'instagram' | 'tiktok' | 'youtube'
): Promise<Record<string, number>> {
  return metricoolFetch<Record<string, number>>(`/stats/${type}/${provider}`, config)
}

export async function getAdsCampaigns(
  config: MetricoolConfig,
  start: string,
  end: string
): Promise<unknown[]> {
  return metricoolFetch<unknown[]>('/stats/ads', config, { start, end })
}

// Date helper: format Date to YYYYMMDD
export function formatDateParam(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}
