import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface PublishedPost {
  id: number
  uuid: string
  text: string
  publicationDate: string
  timezone: string
  platforms: string[]
  draft: boolean
  autoPublish: boolean
  media: { url?: string; type?: string }[]
  clientName?: string
  clientId?: string
  blogId: string
}

async function fetchMetricoolPosts(blogId: string, start: string, end: string) {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!token || !userId) return []

  const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=${start}&end=${end}`
  const res = await fetch(url, {
    headers: { 'X-Mc-Auth': token },
    next: { revalidate: 60 },
  })
  if (!res.ok) return []

  const json = await res.json() as {
    data?: {
      id: number
      uuid: string
      text: string
      publicationDate: { dateTime: string; timezone: string }
      providers: { network: string }[]
      draft: boolean
      autoPublish: boolean
      media?: { url?: string; type?: string }[]
    }[]
  }

  return (json.data || []).map((p) => ({
    id: p.id,
    uuid: p.uuid,
    text: p.text || '',
    publicationDate: p.publicationDate?.dateTime || '',
    timezone: p.publicationDate?.timezone || 'America/Puerto_Rico',
    platforms: (p.providers || []).map((x) => x.network),
    draft: p.draft,
    autoPublish: p.autoPublish,
    media: (p.media || []) as { url?: string; type?: string }[],
    blogId,
  }))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const blogId = searchParams.get('blogId')
  const range = searchParams.get('range') || '30d'
  const all = searchParams.get('all') === 'true'
  const todayOnly = searchParams.get('today') === 'true'
  // Direct date params for calendar view — ISO date strings (YYYY-MM-DD)
  const startParam = searchParams.get('startDate')
  const endParam = searchParams.get('endDate')

  let start: Date
  let end: Date

  if (startParam && endParam) {
    start = new Date(startParam + 'T00:00:00')
    end = new Date(endParam + 'T23:59:59')
  } else if (todayOnly) {
    const now = new Date()
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  } else {
    // Default: past range + 30 days into the future for scheduled posts
    start = new Date()
    switch (range) {
      case '7d': start.setDate(start.getDate() - 7); break
      case '14d': start.setDate(start.getDate() - 14); break
      case '30d': start.setDate(start.getDate() - 30); break
      case '90d': start.setDate(start.getDate() - 90); break
      case '180d': start.setDate(start.getDate() - 180); break
    }
    end = new Date()
    end.setDate(end.getDate() + 30) // Always include 30 days of future scheduled posts
  }
  const startStr = start.toISOString().slice(0, 19)
  const endStr = end.toISOString().slice(0, 19)

  try {
    const supabase = await createClient()

    if (all) {
      // Fetch from all active clients with metricool_blog_id in parallel
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, metricool_blog_id')
        .not('metricool_blog_id', 'is', null)
        .eq('status', 'active')
        .limit(50)

      if (!clients?.length) return NextResponse.json({ posts: [] })

      const results = await Promise.allSettled(
        clients.map((c) => fetchMetricoolPosts(c.metricool_blog_id!, startStr, endStr).then((posts) =>
          posts.map((p) => ({ ...p, clientName: c.name, clientId: c.id }))
        ))
      )

      const posts: PublishedPost[] = results
        .filter((r) => r.status === 'fulfilled')
        .flatMap((r) => (r as PromiseFulfilledResult<PublishedPost[]>).value)
        .filter((p) => !p.draft)
        .sort((a, b) => todayOnly
          ? a.publicationDate.localeCompare(b.publicationDate)
          : b.publicationDate.localeCompare(a.publicationDate))

      return NextResponse.json({ posts, clientCount: clients.length })
    }

    // Single blog
    const effectiveBlogId = blogId || process.env.METRICOOL_BLOG_ID
    if (!effectiveBlogId) return NextResponse.json({ posts: [] })

    let clientName: string | undefined
    let clientId: string | undefined
    if (blogId) {
      const { data: c } = await supabase
        .from('clients')
        .select('id, name')
        .eq('metricool_blog_id', blogId)
        .single()
      clientName = c?.name
      clientId = c?.id
    }

    const posts = await fetchMetricoolPosts(effectiveBlogId, startStr, endStr)
    const filtered = posts
      .filter((p) => !p.draft)
      .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
      .map((p) => ({ ...p, clientName, clientId }))

    return NextResponse.json({ posts: filtered })
  } catch (error) {
    console.error('Metricool posts API error:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
