'use client'

import { useState, useEffect, useMemo } from 'react'
import { PublishedFeed } from './published-feed'
import { ContentCalendar } from './content-calendar'
import { Globe, CalendarDays, List, BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { PublishedPost } from '@/app/api/metricool/posts/route'

interface Client {
  id: string
  name: string
  metricool_blog_id: string | null
}

type Tab = 'feed' | 'calendar' | 'clients'

interface PublishedPageClientProps {
  clients: Client[]
}

const networkEmoji: Record<string, string> = {
  instagram: '📸',
  facebook: '👥',
  tiktok: '🎵',
  linkedin: '💼',
  twitter: '𝕏',
  youtube: '▶️',
}

const networkColors: Record<string, string> = {
  facebook: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  instagram: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  tiktok: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  twitter: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20',
  linkedin: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  youtube: 'bg-red-500/10 text-red-600 border-red-500/20',
}

function ClientSummaryView({ clients, onSelectClient }: { clients: Client[]; onSelectClient: (blogId: string) => void }) {
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('30d')
  const [sortBy, setSortBy] = useState<'total' | 'last' | 'name'>('total')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/metricool/posts?all=true&range=${range}`)
      .then((r) => r.json())
      .then((data) => setPosts(data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [range])

  const now = new Date()
  const rangedays = parseInt(range.replace('d', '')) // 7, 14, 30, 90
  const halfPoint = new Date(now)
  halfPoint.setDate(now.getDate() - Math.floor(rangedays / 2))

  const clientStats = useMemo(() => {
    const map = new Map<string, {
      name: string
      total: number
      published: number
      scheduled: number
      firstHalf: number
      secondHalf: number
      platforms: Record<string, number>
      lastPost: string | null
      lastCaption: string | null
      thumbnail: string | null
    }>()

    for (const post of posts) {
      const key = post.clientName ?? 'Sin cliente'
      if (!map.has(key)) {
        map.set(key, { name: key, total: 0, published: 0, scheduled: 0, firstHalf: 0, secondHalf: 0, platforms: {}, lastPost: null, lastCaption: null, thumbnail: null })
      }
      const s = map.get(key)!
      s.total++
      const postDate = new Date(post.publicationDate)
      if (postDate <= now) {
        s.published++
        if (postDate >= halfPoint) s.secondHalf++
        else s.firstHalf++
        if (!s.lastPost || post.publicationDate > s.lastPost) {
          s.lastPost = post.publicationDate
          s.lastCaption = post.text || null
          s.thumbnail = post.media?.[0]?.url ?? null
        }
      } else {
        s.scheduled++
      }
      for (const p of post.platforms) {
        s.platforms[p] = (s.platforms[p] ?? 0) + 1
      }
    }

    const arr = Array.from(map.values())
    if (sortBy === 'name') return arr.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'last') return arr.sort((a, b) => (b.lastPost ?? '').localeCompare(a.lastPost ?? ''))
    return arr.sort((a, b) => b.total - a.total)
  }, [posts, sortBy])

  const totalPublished = posts.filter((p) => new Date(p.publicationDate) <= now).length
  const totalScheduled = posts.filter((p) => new Date(p.publicationDate) > now).length

  return (
    <div className="space-y-5">
      {/* Controls + summary */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {(['7d', '14d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                range === r
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-input text-muted-foreground hover:text-foreground hover:border-primary'
              )}
            >
              {r === '7d' ? '7 días' : r === '14d' ? '14 días' : r === '30d' ? '30 días' : '90 días'}
            </button>
          ))}
          <span className="text-muted-foreground/40">|</span>
          {(['total', 'last', 'name'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                sortBy === s
                  ? 'bg-muted text-foreground border-border'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {s === 'total' ? 'Más publicados' : s === 'last' ? 'Último post' : 'A–Z'}
            </button>
          ))}
        </div>
        {!loading && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="text-green-600 font-medium">{totalPublished} publicados</span>
            <span className="text-yellow-600 font-medium">{totalScheduled} programados</span>
            <span>{clientStats.length} clientes</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : clientStats.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Globe className="mx-auto h-12 w-12 opacity-20 mb-4" />
          <p>No hay posts publicados en este período</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientStats.map((client) => {
            const matchedClient = clients.find((c) => c.name === client.name)
            const daysSincePost = client.lastPost
              ? Math.floor((now.getTime() - new Date(client.lastPost).getTime()) / 86400000)
              : null
            const isStale = daysSincePost !== null && daysSincePost >= 5 && client.scheduled === 0
            // Trend: compare second half vs first half of period
            const trend = client.secondHalf > client.firstHalf ? 'up' : client.secondHalf < client.firstHalf ? 'down' : 'flat'
            return (
            <Card
              key={client.name}
              className={cn(
                'hover:border-primary/40 transition-colors',
                matchedClient?.metricool_blog_id ? 'cursor-pointer' : '',
                isStale ? 'border-orange-200 dark:border-orange-900/40' : ''
              )}
              onClick={() => matchedClient?.metricool_blog_id ? onSelectClient(matchedClient.metricool_blog_id) : undefined}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {client.thumbnail ? (
                      <img src={client.thumbnail} alt="" className="h-10 w-10 rounded-lg object-cover border shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Globe className="h-4 w-4 text-muted-foreground opacity-40" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{client.name}</p>
                      <div className="flex items-center gap-1.5">
                        {client.lastPost ? (
                          <p className={cn('text-[10px]', isStale ? 'text-orange-500 font-medium' : 'text-muted-foreground')}>
                            {isStale ? '⚠️ ' : ''}Último: {new Date(client.lastPost).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}
                            {daysSincePost !== null && daysSincePost > 0 && ` (${daysSincePost}d)`}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground italic">Sin posts</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                    {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-orange-400" />}
                    {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-2xl font-bold text-primary">{client.total}</span>
                  </div>
                </div>

                {client.lastCaption && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed border-l-2 border-border pl-2">
                    {client.lastCaption}
                  </p>
                )}

                {/* Published vs scheduled bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="text-green-600">{client.published} publicados</span>
                    {client.scheduled > 0 && <span className="text-yellow-600">{client.scheduled} programados</span>}
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${client.total > 0 ? Math.round((client.published / client.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Platform breakdown */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(client.platforms)
                    .sort((a, b) => b[1] - a[1])
                    .map(([p, count]) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className={`text-[10px] gap-0.5 px-1.5 py-0.5 ${networkColors[p] ?? ''}`}
                      >
                        {networkEmoji[p] ?? p} {count}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WeekActivityBar() {
  const [weekData, setWeekData] = useState<{ date: string; label: string; day: string; count: number; published: number; scheduled: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/metricool/posts?all=true&range=14d')
      .then((r) => r.json())
      .then((data) => {
        const posts: PublishedPost[] = data.posts || []
        const now = new Date()
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now)
          d.setDate(now.getDate() - 6 + i)
          const dateStr = d.toISOString().slice(0, 10)
          const dayLabel = d.toLocaleDateString('es-PR', { weekday: 'short' })
          const dateLabel = d.toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })
          const dayPosts = posts.filter((p) => p.publicationDate.startsWith(dateStr))
          const published = dayPosts.filter((p) => new Date(p.publicationDate) <= now).length
          const scheduled = dayPosts.filter((p) => new Date(p.publicationDate) > now).length
          return { date: dateStr, label: dateLabel, day: dayLabel, count: dayPosts.length, published, scheduled }
        })
        setWeekData(days)
      })
      .catch(() => setWeekData([]))
      .finally(() => setLoading(false))
  }, [])

  const max = Math.max(...weekData.map((d) => d.count), 1)
  const today = new Date().toISOString().slice(0, 10)
  const totalWeek = weekData.reduce((s, d) => s + d.count, 0)
  const totalPublished = weekData.reduce((s, d) => s + d.published, 0)

  if (loading) return <Skeleton className="h-20 w-full rounded-xl" />

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Esta semana</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span><span className="text-foreground font-semibold">{totalWeek}</span> posts</span>
            <span className="text-green-600 font-medium">{totalPublished} publicados</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-12">
          {weekData.map((d) => {
            const pct = d.count === 0 ? 0 : Math.max(8, Math.round((d.count / max) * 100))
            const isToday = d.date === today
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full flex flex-col items-center justify-end" style={{ height: '40px' }}>
                  {d.count > 0 && (
                    <div
                      className={cn(
                        'w-full rounded-sm transition-all',
                        isToday ? 'bg-primary' : 'bg-primary/30 group-hover:bg-primary/60'
                      )}
                      style={{ height: `${pct}%` }}
                    />
                  )}
                  {d.count === 0 && (
                    <div className="w-full rounded-sm bg-border/50" style={{ height: '4px' }} />
                  )}
                </div>
                <span className={cn('text-[9px] font-medium', isToday ? 'text-primary' : 'text-muted-foreground')}>
                  {d.day}
                </span>
                {/* Tooltip */}
                {d.count > 0 && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover border text-popover-foreground rounded-lg px-2 py-1 text-[10px] whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {d.label}: {d.count} post{d.count !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function PublishedPageClient({ clients }: PublishedPageClientProps) {
  const [tab, setTab] = useState<Tab>('feed')
  const [feedBlogId, setFeedBlogId] = useState<string>('all')

  function handleSelectClient(blogId: string) {
    setFeedBlogId(blogId)
    setTab('feed')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Contenido Publicado
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Todo lo publicado y programado en Metricool
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setTab('feed')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'feed'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-3.5 w-3.5" />
            Por Fecha
          </button>
          <button
            onClick={() => setTab('calendar')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'calendar'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendario
          </button>
          <button
            onClick={() => setTab('clients')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'clients'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Por Cliente
          </button>
        </div>
      </div>

      {/* Week activity bar — always visible */}
      <WeekActivityBar />

      {/* Content */}
      {tab === 'calendar' ? (
        <ContentCalendar clients={clients} />
      ) : tab === 'clients' ? (
        <ClientSummaryView clients={clients} onSelectClient={handleSelectClient} />
      ) : (
        <PublishedFeed clients={clients} initialBlogId={feedBlogId} />
      )}
    </div>
  )
}
