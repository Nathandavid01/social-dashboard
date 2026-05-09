import type { MetricoolConfig } from './client'

const METRICOOL_BASE_URL = 'https://app.metricool.com/api'

export interface ScheduledPostProvider {
  network: string
  id: string
  status: 'PUBLISHED' | 'PENDING' | 'ERROR' | string
  publicUrl?: string
  detailedStatus?: string
}

export interface ScheduledPost {
  id: number
  uuid: string
  publicationDate: {
    dateTime: string
    timezone: string
  }
  creationDate?: {
    dateTime: string
    timezone: string
  }
  text: string
  providers: ScheduledPostProvider[]
  autoPublish: boolean
  draft: boolean
  brandName?: string
  targetBrandId?: number
  media?: unknown[]
}

export interface ScheduleVerification {
  post: ScheduledPost
  scheduledTime: string
  timezone: string
  providers: ProviderVerification[]
  overallStatus: 'on-time' | 'late' | 'pending' | 'error' | 'draft'
}

export interface ProviderVerification {
  network: string
  status: string
  detailedStatus: string
  publicUrl?: string
  isError: boolean
  isPending: boolean
  isPublished: boolean
}

async function schedulerFetch<T>(
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
    headers: { 'X-Mc-Auth': config.userToken },
  })

  if (!response.ok) {
    throw new Error(`Metricool API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export async function getScheduledPosts(
  config: MetricoolConfig,
  start: string,
  end: string,
  timezone = 'America/Puerto_Rico'
): Promise<ScheduledPost[]> {
  const response = await schedulerFetch<{ data: ScheduledPost[] } | ScheduledPost[]>(
    '/v2/scheduler/posts',
    config,
    { start, end, timezone, extendedRange: 'true' }
  )
  return Array.isArray(response) ? response : response.data ?? []
}

export function verifySchedule(posts: ScheduledPost[]): ScheduleVerification[] {
  return posts.map((post) => {
    const providerVerifications: ProviderVerification[] = post.providers.map((prov) => ({
      network: prov.network,
      status: prov.status,
      detailedStatus: prov.detailedStatus ?? prov.status,
      publicUrl: prov.publicUrl,
      isError: prov.status === 'ERROR',
      isPending: prov.status === 'PENDING',
      isPublished: prov.status === 'PUBLISHED',
    }))

    let overallStatus: ScheduleVerification['overallStatus'] = 'on-time'

    if (post.draft) {
      overallStatus = 'draft'
    } else if (providerVerifications.some((p) => p.isError)) {
      overallStatus = 'error'
    } else if (providerVerifications.some((p) => p.isPending)) {
      overallStatus = 'pending'
    } else if (providerVerifications.every((p) => p.isPublished)) {
      overallStatus = 'on-time'
    }

    return {
      post,
      scheduledTime: post.publicationDate.dateTime,
      timezone: post.publicationDate.timezone,
      providers: providerVerifications,
      overallStatus,
    }
  })
}

export function getScheduleStats(verifications: ScheduleVerification[]) {
  const total = verifications.length
  const published = verifications.filter((v) => v.overallStatus === 'on-time').length
  const errors = verifications.filter((v) => v.overallStatus === 'error').length
  const pending = verifications.filter((v) => v.overallStatus === 'pending').length
  const drafts = verifications.filter((v) => v.overallStatus === 'draft').length

  return {
    total,
    published,
    errors,
    pending,
    drafts,
    successRate: total > 0 ? Math.round((published / (total - drafts)) * 100) : 0,
  }
}
