'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { format, subDays, parseISO } from 'date-fns'

// recharts loaded lazily: /performance shouldn't pay for it in the initial
// JS bundle (see engagement-bar-chart.tsx).
const EngagementBarChart = dynamic(
  () => import('./engagement-bar-chart').then((m) => m.EngagementBarChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> },
)

interface MetricoolPost {
  publicationDate: string
  platforms: string[]
  clientName?: string
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#ec4899',
  facebook: '#3b82f6',
  tiktok: '#94a3b8',
  linkedin: '#0ea5e9',
}

function buildChartData(posts: MetricoolPost[], days = 14) {
  const buckets: Record<string, Record<string, number>> = {}
  for (let i = 0; i < days; i++) {
    const d = format(subDays(new Date(), days - 1 - i), 'MMM d')
    buckets[d] = {}
  }

  for (const post of posts) {
    try {
      const dateKey = format(parseISO(post.publicationDate), 'MMM d')
      if (buckets[dateKey] !== undefined) {
        for (const p of post.platforms) {
          buckets[dateKey][p] = (buckets[dateKey][p] ?? 0) + 1
        }
      }
    } catch { /* skip malformed dates */ }
  }

  return Object.entries(buckets).map(([date, counts]) => ({ date, ...counts }))
}

export function EngagementChart() {
  const [posts, setPosts] = useState<MetricoolPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/metricool/posts?all=true&range=14d')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const platforms = useMemo(() => {
    const all = posts.flatMap((p) => p.platforms)
    return Array.from(new Set(all)).filter((p) => p in PLATFORM_COLORS)
  }, [posts])

  const data = useMemo(() => buildChartData(posts, 14), [posts])
  const totalPosts = posts.length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Posts Publicados (14 días)</CardTitle>
        <p className="text-xs text-muted-foreground">
          {loading ? 'Cargando...' : `${totalPosts} posts de Metricool`}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <EngagementBarChart data={data} platforms={platforms} />
        )}
      </CardContent>
    </Card>
  )
}
