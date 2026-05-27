'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, CalendarRange, Copy, CheckCheck } from 'lucide-react'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
import { cn } from '@/lib/utils'

interface Client {
  id: string
  name: string
  metricool_blog_id: string | null
}

const networkColors: Record<string, string> = {
  facebook: 'bg-blue-500 text-white',
  instagram: 'bg-pink-500 text-white',
  tiktok: 'bg-cyan-500 text-white',
  twitter: 'bg-neutral-600 text-white',
  linkedin: 'bg-sky-600 text-white',
  youtube: 'bg-red-500 text-white',
}
const networkBadgeColors: Record<string, string> = {
  facebook: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  instagram: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  tiktok: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  twitter: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20',
  linkedin: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  youtube: 'bg-red-500/10 text-red-600 border-red-500/20',
}
const networkEmoji: Record<string, string> = {
  instagram: '📸', facebook: '👥', tiktok: '🎵', linkedin: '💼', twitter: '𝕏', youtube: '▶️',
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function formatWeekHeader(start: Date) {
  const end = addDays(start, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('es-PR', opts)} – ${end.toLocaleDateString('es-PR', { ...opts, year: 'numeric' })}`
}

// ── Post Pill (calendar cell) ─────────────────────────────────────────────────

function CalendarPostPill({ post, compact = false }: { post: PublishedPost; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const isScheduled = new Date(post.publicationDate) > new Date()
  const platform = post.platforms[0] ?? 'instagram'
  const colorClass = networkColors[platform] ?? 'bg-primary text-primary-foreground'

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!post.text) return
    navigator.clipboard.writeText(post.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="group relative">
      <div
        className={cn(
          'flex items-start gap-1 rounded-md cursor-pointer hover:opacity-90 transition-opacity leading-snug',
          compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]',
          colorClass,
          isScheduled && 'opacity-60 ring-1 ring-inset ring-white/30'
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="shrink-0 text-[10px] mt-px">{networkEmoji[platform] ?? '📄'}</span>
        <div className="min-w-0 flex-1">
          {post.clientName && (
            <p className="font-semibold truncate">{post.clientName}</p>
          )}
          {!compact && (
            <p className="opacity-80 truncate">
              {post.text?.slice(0, 35) || '(sin texto)'}
            </p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="absolute z-30 left-0 top-full mt-1 w-72 rounded-xl border bg-popover text-popover-foreground shadow-2xl p-3.5 space-y-2.5">
          {post.clientName && (
            <p className="text-xs font-semibold text-primary">{post.clientName}</p>
          )}
          <div className="flex flex-wrap gap-1">
            {post.platforms.map((p) => (
              <Badge key={p} variant="outline" className={cn('text-[10px]', networkBadgeColors[p] ?? '')}>
                {networkEmoji[p] ?? ''} {p}
              </Badge>
            ))}
            <Badge variant="outline" className={cn('text-[10px]', isScheduled ? 'text-yellow-600 border-yellow-500/30' : 'text-green-600 border-green-500/30')}>
              {isScheduled ? '🕐 Programado' : '✅ Publicado'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(post.publicationDate).toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </p>
          {post.text && (
            <div className="relative">
              <p className="text-xs whitespace-pre-line line-clamp-6 pr-6">{post.text}</p>
              <button onClick={copy} className="absolute top-0 right-0 text-muted-foreground hover:text-foreground p-0.5">
                {copied ? <CheckCheck className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          )}
          {post.media?.[0]?.url && (
            <img src={post.media[0].url} alt="" className="h-24 w-full object-cover rounded-lg border" />
          )}
          <button
            className="text-[10px] text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
          >
            Cerrar ×
          </button>
        </div>
      )}
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({
  weekStart,
  posts,
  loading,
  today,
}: {
  weekStart: Date
  posts: PublishedPost[]
  loading: boolean
  today: Date
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const postsForDay = (day: Date) =>
    posts.filter((p) => isSameDay(new Date(p.publicationDate), day))
      .sort((a, b) => a.publicationDate.localeCompare(b.publicationDate))

  const weekTotal = days.reduce((sum, d) => sum + postsForDay(d).length, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{weekTotal} post{weekTotal !== 1 ? 's' : ''} esta semana</p>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
        {days.map((day, i) => {
          const isT = isSameDay(day, today)
          return (
            <div key={i} className={cn('bg-background px-2 py-2 text-center', isT && 'bg-primary/5')}>
              <p className="text-[10px] text-muted-foreground font-medium uppercase">{DAY_LABELS[i]}</p>
              <p className={cn('text-sm font-bold', isT && 'text-primary')}>{day.getDate()}</p>
            </div>
          )
        })}
        {days.map((day, i) => {
          const dayPosts = postsForDay(day)
          const isT = isSameDay(day, today)
          return (
            <div key={i} className={cn('bg-background min-h-[140px] px-1.5 py-2 space-y-1', isT && 'bg-primary/5')}>
              {loading ? (
                <div className="space-y-1">
                  <Skeleton className="h-8 w-full rounded" />
                  <Skeleton className="h-8 w-3/4 rounded" />
                </div>
              ) : dayPosts.length === 0 ? (
                <div className="h-full flex items-center justify-center opacity-20 text-xs text-muted-foreground">—</div>
              ) : (
                dayPosts.map((post) => <CalendarPostPill key={post.id} post={post} />)
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({
  month,
  posts,
  loading,
  today,
}: {
  month: Date
  posts: PublishedPost[]
  loading: boolean
  today: Date
}) {
  const monthStart = startOfMonth(month)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const startDow = monthStart.getDay()
  const days: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: monthEnd.getDate() }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ]
  while (days.length % 7 !== 0) days.push(null)

  const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const postsForDay = (day: Date) =>
    posts.filter((p) => isSameDay(new Date(p.publicationDate), day))
      .sort((a, b) => a.publicationDate.localeCompare(b.publicationDate))

  const monthTotal = posts.filter((p) => isSameMonth(new Date(p.publicationDate), month)).length
  const published = posts.filter((p) => isSameMonth(new Date(p.publicationDate), month) && new Date(p.publicationDate) <= today).length
  const scheduled = posts.filter((p) => isSameMonth(new Date(p.publicationDate), month) && new Date(p.publicationDate) > today).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{monthTotal} posts</span>
        <span className="text-green-600 font-medium">{published} publicados</span>
        <span className="text-yellow-600 font-medium">{scheduled} programados</span>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center py-2 text-[10px] font-semibold text-muted-foreground uppercase">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border">
          {days.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="bg-background min-h-[100px]" />
            const dayPosts = postsForDay(day)
            const isT = isSameDay(day, today)
            const inMonth = isSameMonth(day, month)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'bg-background min-h-[100px] p-1.5 space-y-0.5',
                  isT && 'bg-primary/5',
                  !inMonth && 'opacity-30'
                )}
              >
                <div className={cn(
                  'text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  isT ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}>
                  {day.getDate()}
                </div>
                {loading ? (
                  <Skeleton className="h-5 w-full rounded" />
                ) : (
                  <>
                    {dayPosts.slice(0, 3).map((post) => (
                      <CalendarPostPill key={post.id} post={post} compact />
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-[9px] text-muted-foreground pl-1 font-medium">+{dayPosts.length - 3} más</p>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ContentCalendarProps {
  clients: Client[]
}

export function ContentCalendar({ clients }: ContentCalendarProps) {
  const [calView, setCalView] = useState<'week' | 'month'>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()))
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBlogId, setSelectedBlogId] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let windowStart: Date
      let windowEnd: Date

      if (calView === 'week') {
        windowStart = addDays(weekStart, -14)
        windowEnd = addDays(weekStart, 21)
      } else {
        windowStart = new Date(month.getFullYear(), month.getMonth() - 1, 1)
        windowEnd = new Date(month.getFullYear(), month.getMonth() + 2, 1)
      }

      const fmt = (d: Date) => d.toISOString().slice(0, 10)
      const params = new URLSearchParams({ startDate: fmt(windowStart), endDate: fmt(windowEnd) })
      if (selectedBlogId === 'all') params.set('all', 'true')
      else params.set('blogId', selectedBlogId)

      const res = await fetch(`/api/metricool/posts?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPosts(data.posts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando posts')
    } finally {
      setLoading(false)
    }
  }, [selectedBlogId, weekStart, month, calView])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const today = useMemo(() => new Date(), [])

  const headerLabel = calView === 'week'
    ? formatWeekHeader(weekStart)
    : (() => { const s = month.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) })()

  function prev() {
    if (calView === 'week') setWeekStart((d) => addDays(d, -7))
    else setMonth((d) => addMonths(d, -1))
  }

  function next() {
    if (calView === 'week') setWeekStart((d) => addDays(d, 7))
    else setMonth((d) => addMonths(d, 1))
  }

  function goToday() {
    setWeekStart(startOfWeek(new Date()))
    setMonth(startOfMonth(new Date()))
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
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

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
          <button
            onClick={() => setCalView('week')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              calView === 'week' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Semana
          </button>
          <button
            onClick={() => setCalView('month')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              calView === 'month' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Mes
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={goToday}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 ml-1" onClick={fetchPosts} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Navigation header */}
      <h3 className="text-sm font-semibold">{headerLabel}</h3>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {calView === 'week' ? (
        <WeekView weekStart={weekStart} posts={posts} loading={loading} today={today} />
      ) : (
        <MonthView month={month} posts={posts} loading={loading} today={today} />
      )}

      <p className="text-xs text-muted-foreground text-center">
        Haz clic en cualquier post para ver el caption y detalles
      </p>
    </div>
  )
}
