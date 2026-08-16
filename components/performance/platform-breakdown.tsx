'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// recharts loaded lazily: /performance shouldn't pay for it in the initial
// JS bundle (see platform-pie-chart.tsx).
const PlatformPieChart = dynamic(
  () => import('./platform-pie-chart').then((m) => m.PlatformPieChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> },
)

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#ec4899',
  facebook: '#3b82f6',
  tiktok: '#94a3b8',
  linkedin: '#0ea5e9',
  youtube: '#ef4444',
  twitter: '#71717a',
}

interface MetricoolPost {
  platforms: string[]
}

export function PlatformBreakdown() {
  const [posts, setPosts] = useState<MetricoolPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/metricool/posts?all=true&range=30d')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const post of posts) {
      for (const p of post.platforms) {
        counts[p] = (counts[p] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: PLATFORM_COLORS[name] ?? '#6b7280' }))
      .sort((a, b) => b.value - a.value)
  }, [posts])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Posts por Plataforma</CardTitle>
        <p className="text-xs text-muted-foreground">
          {loading ? 'Cargando...' : `${total} posts · últimos 30 días`}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : data.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Sin datos de Metricool
          </div>
        ) : (
          <PlatformPieChart data={data} />
        )}
      </CardContent>
    </Card>
  )
}
