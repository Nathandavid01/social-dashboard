'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw, ChevronDown, ChevronUp, ExternalLink, ImageIcon } from 'lucide-react'
import type { PublishedPost } from '@/app/api/metricool/posts/route'

type Range = '7d' | '14d' | '30d' | '90d' | '180d'

interface Client {
  id: string
  name: string
  metricool_blog_id: string | null
}

const networkColors: Record<string, string> = {
  facebook: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  tiktok: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  twitter: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  linkedin: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  youtube: 'bg-red-500/10 text-red-500 border-red-500/20',
}

const networkEmoji: Record<string, string> = {
  instagram: '📸',
  facebook: '👥',
  tiktok: '🎵',
  linkedin: '💼',
  twitter: '𝕏',
  youtube: '▶️',
}

const NetworkIcon = ({ network }: { network: string }) => (
  <span className="text-[10px]">{networkEmoji[network] ?? network}</span>
)

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('es-PR', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return dateStr }
}

function groupByDate(posts: PublishedPost[]): Record<string, PublishedPost[]> {
  return posts.reduce((acc, post) => {
    const date = post.publicationDate.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(post)
    return acc
  }, {} as Record<string, PublishedPost[]>)
}

function formatGroupDate(dateStr: string) {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-PR', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch { return dateStr }
}

function PostCard({ post }: { post: PublishedPost }) {
  const [expanded, setExpanded] = useState(false)
  const isScheduled = new Date(post.publicationDate) > new Date()

  return (
    <div className="rounded-lg border bg-card hover:bg-muted/20 transition-colors">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Thumbnail placeholder */}
        <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {post.media?.[0]?.url ? (
            <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground opacity-40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {post.clientName && (
              <span className="text-xs font-semibold text-primary">{post.clientName}</span>
            )}
            <Badge
              variant="outline"
              className={isScheduled
                ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10 text-xs'
                : 'text-green-500 border-green-500/30 bg-green-500/10 text-xs'}
            >
              {isScheduled ? 'Programado' : 'Publicado'}
            </Badge>
            {post.platforms.map((p) => (
              <Badge key={p} variant="outline" className={`text-xs gap-1 ${networkColors[p] ?? ''}`}>
                <NetworkIcon network={p} />
                {p}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatDate(post.publicationDate)}</span>
          </div>
          <p className="text-sm line-clamp-2 text-muted-foreground leading-relaxed">
            {post.text || '(sin texto)'}
          </p>
        </div>

        <div className="shrink-0 ml-1">
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t space-y-3">
          <p className="text-sm whitespace-pre-line leading-relaxed">{post.text}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>ID: {post.id}</span>
            <a
              href="https://app.metricool.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              Ver en Metricool <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export function PublishedFeed({ clients }: { clients: Client[] }) {
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('14d')
  const [selectedBlogId, setSelectedBlogId] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [totalFetched, setTotalFetched] = useState(0)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ range })
      if (selectedBlogId === 'all') {
        params.set('all', 'true')
      } else {
        params.set('blogId', selectedBlogId)
      }
      const res = await fetch(`/api/metricool/posts?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPosts(data.posts || [])
      setTotalFetched(data.clientCount || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando posts')
    } finally {
      setLoading(false)
    }
  }, [range, selectedBlogId])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const grouped = groupByDate(posts)
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const published = posts.filter((p) => new Date(p.publicationDate) <= new Date())
  const scheduled = posts.filter((p) => new Date(p.publicationDate) > new Date())

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedBlogId} onValueChange={setSelectedBlogId}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Todos los clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.filter((c) => c.metricool_blog_id).map((c) => (
                <SelectItem key={c.id} value={c.metricool_blog_id!}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="14d">Últimas 2 semanas</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
              <SelectItem value="180d">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPosts} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        {[
          { label: 'Total posts', value: loading ? '—' : posts.length },
          { label: 'Publicados', value: loading ? '—' : published.length },
          { label: 'Programados', value: loading ? '—' : scheduled.length },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              {loading ? <Skeleton className="h-7 w-12 mt-1" /> : <p className="text-2xl font-bold">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Posts grouped by date */}
      {!loading && dates.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-sm">No se encontraron posts en este rango</p>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {formatGroupDate(date)}
                </h3>
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">{grouped[date].length} posts</span>
              </div>
              <div className="space-y-2">
                {grouped[date].map((post) => <PostCard key={post.id} post={post} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedBlogId === 'all' && totalFetched > 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center">
          Mostrando posts de {totalFetched} cuentas de Metricool
        </p>
      )}
    </div>
  )
}
