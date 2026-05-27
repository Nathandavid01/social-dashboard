'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw, ChevronDown, ChevronUp, ExternalLink, ImageIcon, Search, X, Copy, CheckCheck } from 'lucide-react'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
import { cn } from '@/lib/utils'

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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 rounded shrink-0"
      title="Copiar caption"
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function PostCard({ post }: { post: PublishedPost }) {
  const [expanded, setExpanded] = useState(false)
  const isScheduled = new Date(post.publicationDate) > new Date()
  const hasMedia = post.media?.some(m => m.url)
  const mediaCount = post.media?.filter(m => m.url).length ?? 0

  return (
    <div className={cn(
      'rounded-lg border bg-card hover:bg-muted/20 transition-colors group',
      isScheduled && 'border-yellow-200/60 dark:border-yellow-900/30',
    )}>
      <div
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Thumbnail */}
        <div className="relative h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {post.media?.[0]?.url ? (
            <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground opacity-40" />
          )}
          {mediaCount > 1 && (
            <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded font-medium">
              +{mediaCount - 1}
            </span>
          )}
          {isScheduled && (
            <span className="absolute top-0.5 left-0.5 bg-yellow-400 text-yellow-900 text-[8px] px-1 rounded font-bold leading-tight">
              PROG
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {post.clientName && (
              <span className="text-xs font-semibold text-primary truncate max-w-[150px]">{post.clientName}</span>
            )}
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{formatDate(post.publicationDate)}</span>
            <div className="flex items-center gap-1 ml-auto shrink-0">
              {post.platforms.map((p) => (
                <span key={p} className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', networkColors[p] ?? 'text-muted-foreground border-muted')}>
                  {networkEmoji[p] ?? p}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm line-clamp-2 text-foreground/80 leading-relaxed">
            {post.text || <span className="italic text-muted-foreground">(sin texto)</span>}
          </p>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {post.text && <CopyButton text={post.text} />}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t space-y-3">
          <p className="text-sm whitespace-pre-line leading-relaxed">{post.text}</p>
          {hasMedia && (
            <div className="flex gap-2 flex-wrap">
              {post.media!.filter(m => m.url).slice(0, 8).map((m, i) => (
                <img key={i} src={m.url} alt="" className="h-24 w-24 rounded-lg object-cover border border-border" />
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
            <span className="font-mono">ID {post.id}</span>
            <span>{post.platforms.join(', ')}</span>
            <a
              href="https://app.metricool.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 ml-auto"
            >
              Ver en Metricool <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function DateGroup({ date, posts }: { date: string; posts: PublishedPost[] }) {
  const [copied, setCopied] = useState(false)
  const copyAll = () => {
    const text = posts
      .filter((p) => p.text)
      .map((p, i) => `--- Post ${i + 1} (${p.platforms.join(', ')}) ---\n${p.text}`)
      .join('\n\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const platformCounts = posts.reduce((acc, p) => {
    p.platforms.forEach((pl) => { acc[pl] = (acc[pl] ?? 0) + 1 })
    return acc
  }, {} as Record<string, number>)

  const clientNames = Array.from(new Set(posts.map((p) => p.clientName).filter(Boolean))) as string[]
  const clientSummary = clientNames.length <= 3
    ? clientNames.join(' · ')
    : `${clientNames.slice(0, 3).join(' · ')} +${clientNames.length - 3} más`

  return (
    <div>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
              {formatGroupDate(date)}
            </h3>
            <div className="flex-1 border-t border-border" />
            <div className="flex items-center gap-1.5 shrink-0">
              {Object.entries(platformCounts).map(([p, count]) => (
                <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${networkColors[p] ?? 'text-muted-foreground'}`}>
                  {networkEmoji[p] ?? p} {count}
                </span>
              ))}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{posts.length} posts</span>
            {posts.some((p) => p.text) && (
              <button
                onClick={copyAll}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors shrink-0"
                title="Copiar todos los captions del día"
              >
                {copied ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copiado' : 'Copiar todos'}
              </button>
            )}
          </div>
          {clientSummary && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{clientSummary}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {posts.map((post) => <PostCard key={post.id} post={post} />)}
      </div>
    </div>
  )
}

type DateShortcut = 'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month'

const DATE_SHORTCUTS: { key: DateShortcut; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'this_week', label: 'Esta semana' },
  { key: 'last_week', label: 'Semana pasada' },
  { key: 'this_month', label: 'Este mes' },
  { key: 'last_month', label: 'Mes pasado' },
]

// Build list of the last 12 months for the month picker
function getMonthOptions(): { value: string; label: string }[] {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' })
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

function getMonthBounds(yearMonth: string): { from: string; to: string } {
  const [year, month] = yearMonth.split('-').map(Number)
  const from = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const to = new Date(year, month, 0).toISOString().slice(0, 10)
  return { from, to }
}

function getDateBounds(shortcut: DateShortcut): { from: string; to: string } | null {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  if (shortcut === 'today') return { from: today, to: today }
  if (shortcut === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1)
    const s = y.toISOString().slice(0, 10)
    return { from: s, to: s }
  }
  if (shortcut === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { from, to }
  }
  if (shortcut === 'last_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
    const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
    return { from, to }
  }
  if (shortcut === 'this_week') {
    const dow = now.getDay()
    const mon = new Date(now); mon.setDate(now.getDate() - dow + (dow === 0 ? -6 : 1))
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
  }
  if (shortcut === 'last_week') {
    const dow = now.getDay()
    const mon = new Date(now); mon.setDate(now.getDate() - dow + (dow === 0 ? -6 : 1) - 7)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
  }
  return null
}

function PublishedFeedInner({ clients, initialBlogId }: { clients: Client[]; initialBlogId?: string }) {
  const searchParams = useSearchParams()
  const defaultBlogId = initialBlogId ?? searchParams.get('blogId') ?? 'all'

  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('14d')
  const [selectedBlogId, setSelectedBlogId] = useState<string>(defaultBlogId)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [totalFetched, setTotalFetched] = useState(0)
  const [dateShortcut, setDateShortcut] = useState<DateShortcut>('all')
  const [jumpDate, setJumpDate] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')

  const MONTH_OPTIONS = getMonthOptions()

  // Sync when parent switches to a specific client
  useEffect(() => {
    if (initialBlogId && initialBlogId !== selectedBlogId) {
      setSelectedBlogId(initialBlogId)
    }
  }, [initialBlogId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('range', range)
      if (selectedBlogId === 'all') params.set('all', 'true')
      else params.set('blogId', selectedBlogId)
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

  // Auto-expand range when jump date or month shortcut falls outside the loaded window
  useEffect(() => {
    if (jumpDate) {
      const daysDiff = Math.floor((Date.now() - new Date(jumpDate).getTime()) / 86400000)
      const rangeMap: Record<Range, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180 }
      if (daysDiff > rangeMap[range]) {
        setRange(daysDiff <= 30 ? '30d' : daysDiff <= 90 ? '90d' : '180d')
      }
    }
    if (dateShortcut === 'this_month') {
      const dayOfMonth = new Date().getDate()
      const rangeMap: Record<Range, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180 }
      if (dayOfMonth > rangeMap[range]) setRange('30d')
    }
    if (dateShortcut === 'last_month') {
      const now = new Date()
      const daysFromLastMonthStart = now.getDate() + new Date(now.getFullYear(), now.getMonth(), 0).getDate()
      const rangeMap: Record<Range, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180 }
      if (daysFromLastMonthStart > rangeMap[range]) {
        setRange(daysFromLastMonthStart <= 60 ? '90d' : '180d')
      }
    }
    if (selectedMonth) {
      // Month picker: auto-expand range to cover the selected month
      const bounds = getMonthBounds(selectedMonth)
      const daysFromStart = Math.floor((Date.now() - new Date(bounds.from).getTime()) / 86400000)
      const rangeMap: Record<Range, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180 }
      if (daysFromStart > rangeMap[range]) {
        setRange(daysFromStart <= 30 ? '30d' : daysFromStart <= 90 ? '90d' : '180d')
      }
    }
  }, [jumpDate, dateShortcut, selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive available platforms from fetched posts
  const availablePlatforms = useMemo(() => {
    const all = posts.flatMap((p) => p.platforms)
    return Array.from(new Set(all)).sort()
  }, [posts])

  // Apply local filters (search + platform + date shortcut + month) without re-fetching
  const filteredPosts = useMemo(() => {
    let result = posts
    if (selectedPlatform !== 'all') {
      result = result.filter((p) => p.platforms.includes(selectedPlatform))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (p) =>
          p.text?.toLowerCase().includes(q) ||
          p.clientName?.toLowerCase().includes(q)
      )
    }
    if (selectedMonth) {
      const bounds = getMonthBounds(selectedMonth)
      result = result.filter((p) => {
        const d = p.publicationDate.slice(0, 10)
        return d >= bounds.from && d <= bounds.to
      })
    } else if (dateShortcut !== 'all') {
      const bounds = getDateBounds(dateShortcut)
      if (bounds) {
        result = result.filter((p) => {
          const d = p.publicationDate.slice(0, 10)
          return d >= bounds.from && d <= bounds.to
        })
      }
    }
    if (jumpDate) {
      result = result.filter((p) => p.publicationDate.slice(0, 10) === jumpDate)
    }
    return result
  }, [posts, selectedPlatform, search, dateShortcut, jumpDate, selectedMonth])

  const grouped = groupByDate(filteredPosts)
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const published = filteredPosts.filter((p) => new Date(p.publicationDate) <= new Date())
  const scheduled = filteredPosts.filter((p) => new Date(p.publicationDate) > new Date())

  const hasFilters = search.trim() !== '' || selectedPlatform !== 'all' || dateShortcut !== 'all' || jumpDate !== '' || selectedMonth !== ''

  const clearAllFilters = () => {
    setSearch('')
    setSelectedPlatform('all')
    setDateShortcut('all')
    setJumpDate('')
    setSelectedMonth('')
  }

  return (
    <div className="space-y-6">
      {/* Date shortcut pills + month picker + jump to date */}
      <div className="flex items-center gap-2 flex-wrap">
        {DATE_SHORTCUTS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setDateShortcut(dateShortcut === key ? 'all' : key); setJumpDate(''); setSelectedMonth('') }}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              dateShortcut === key && !selectedMonth && !jumpDate
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-input text-muted-foreground hover:text-foreground hover:border-primary/50'
            )}
          >
            {label}
          </button>
        ))}

        {/* Month picker */}
        <div className="flex items-center gap-1">
          <select
            value={selectedMonth}
            onChange={e => { setSelectedMonth(e.target.value); setDateShortcut('all'); setJumpDate('') }}
            className={cn(
              'h-7 px-2 rounded-full border text-xs font-medium bg-background transition-colors cursor-pointer focus:outline-none',
              selectedMonth
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input text-muted-foreground hover:border-primary/50'
            )}
          >
            <option value="">Ir a mes...</option>
            {MONTH_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {selectedMonth && (
            <button onClick={() => setSelectedMonth('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <input
            type="date"
            value={jumpDate}
            onChange={(e) => { setJumpDate(e.target.value); setDateShortcut('all'); setSelectedMonth('') }}
            className="h-7 px-2 rounded-md border border-input bg-background text-xs text-muted-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
            title="Ir a una fecha específica"
          />
          {jumpDate && (
            <button onClick={() => setJumpDate('')} className="text-muted-foreground hover:text-foreground" title="Clear date">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
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
            {availablePlatforms.length > 1 && (
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Red social" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las redes</SelectItem>
                  {availablePlatforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      {networkEmoji[p] ?? ''} {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchPosts} disabled={loading} title="Refresh">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar en captions o por cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        {[
          { label: hasFilters ? 'Filtrados' : 'Total', value: loading ? '—' : filteredPosts.length },
          { label: 'Publicados', value: loading ? '—' : published.length, color: 'text-green-500' },
          { label: 'Programados', value: loading ? '—' : scheduled.length, color: 'text-yellow-500' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              {loading ? <Skeleton className="h-7 w-12 mt-1" /> : <p className={`text-2xl font-bold ${color ?? ''}`}>{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform breakdown bar */}
      {!loading && filteredPosts.length > 0 && (() => {
        const platformCounts = filteredPosts.reduce((acc, p) => {
          p.platforms.forEach((pl) => { acc[pl] = (acc[pl] ?? 0) + 1 })
          return acc
        }, {} as Record<string, number>)
        return (
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(platformCounts).sort((a, b) => b[1] - a[1]).map(([p, count]) => (
              <button
                key={p}
                onClick={() => setSelectedPlatform(selectedPlatform === p ? 'all' : p)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  selectedPlatform === p
                    ? 'bg-primary text-primary-foreground border-primary'
                    : `${networkColors[p] ?? 'text-muted-foreground border-input'} hover:opacity-80`
                )}
                title={`Filter by ${p}`}
              >
                <span>{networkEmoji[p] ?? p}</span>
                <span>{count}</span>
              </button>
            ))}
            {selectedPlatform !== 'all' && (
              <button onClick={() => setSelectedPlatform('all')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="h-3 w-3" /> Todas
              </button>
            )}
          </div>
        )
      })()}

      {/* Per-client post count (only when viewing all clients) */}
      {!loading && filteredPosts.length > 0 && selectedBlogId === 'all' && (() => {
        const clientCounts = filteredPosts.reduce((acc, p) => {
          if (p.clientName) acc[p.clientName] = (acc[p.clientName] ?? 0) + 1
          return acc
        }, {} as Record<string, number>)
        const sorted = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])
        if (sorted.length < 2) return null
        return (
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Posts por cliente</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {sorted.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => {
                    const client = clients.find((c) => c.name === name)
                    if (client?.metricool_blog_id) setSelectedBlogId(client.metricool_blog_id)
                  }}
                  className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors"
                  title={`Filter by ${name}`}
                >
                  <span className="font-semibold text-foreground">{name}</span>
                  <span className="text-muted-foreground">{count}</span>
                  <div className="h-1 rounded-full bg-primary/30" style={{ width: `${Math.max(12, (count / sorted[0][1]) * 48)}px` }} />
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {hasFilters && !loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            Mostrando <strong className="text-foreground">{filteredPosts.length}</strong> de {posts.length} posts
            {selectedMonth && ` · ${MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label}`}
          </span>
          <button onClick={clearAllFilters} className="text-primary hover:underline flex items-center gap-1">
            <X className="h-3 w-3" /> Limpiar filtros
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!loading && dates.length === 0 && !error && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            {jumpDate ? (
              <>
                <p className="text-sm font-medium">No hay posts para el {new Date(jumpDate + 'T12:00:00').toLocaleDateString('es-PR', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <p className="text-xs">El rango cargado es <strong>{range}</strong>. Si esta fecha es más antigua, expande el rango.</p>
                <button
                  onClick={() => setJumpDate('')}
                  className="text-xs text-primary hover:underline"
                >
                  Ver todos los posts
                </button>
              </>
            ) : (
              <p className="text-sm">{hasFilters ? 'No se encontraron posts con estos filtros' : 'No se encontraron posts en este rango'}</p>
            )}
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
            <DateGroup key={date} date={date} posts={grouped[date]} />
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

export function PublishedFeed({ clients, initialBlogId }: { clients: Client[]; initialBlogId?: string }) {
  return (
    <Suspense>
      <PublishedFeedInner clients={clients} initialBlogId={initialBlogId} />
    </Suspense>
  )
}
