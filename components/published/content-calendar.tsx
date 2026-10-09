'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, ImageIcon, ArrowUpRight } from 'lucide-react'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
import { calendarPostDate, calendarPostState, puertoRicoNow, type CalendarPostState } from '@/lib/published/calendar-post'
import { cn } from '@/lib/utils'

interface Client { id: string; name: string; metricool_blog_id: string | null }
const states: Record<CalendarPostState, { label: string; color: string }> = {
  scheduled: { label: 'Programado', color: 'bg-violet-500/15 text-violet-400' },
  draft: { label: 'Borrador', color: 'bg-amber-500/15 text-amber-500' },
  published: { label: 'Publicado', color: 'bg-emerald-500/15 text-emerald-500' },
  error: { label: 'Error', color: 'bg-red-500/15 text-red-400' },
  unknown: { label: 'Sin confirmar', color: 'bg-muted text-muted-foreground' },
}
const platforms: Record<string, string> = { instagram: 'text-pink-400', facebook: 'text-blue-400', tiktok: 'text-cyan-400', youtube: 'text-red-400' }
const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const key = (p: PublishedPost) => `${p.blogId}:${p.id}`
function StateBadge({ post }: { post: PublishedPost }) {
  const state = states[calendarPostState(post)]
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', state.color)}>{state.label}</span>
}
function Thumbnail({ post, className }: { post: PublishedPost; className?: string }) {
  const [failed, setFailed] = useState(false)
  const media = post.media?.[0]
  const isVideo = media?.type?.toLowerCase().includes('video') || /\.(mp4|mov|webm)(?:\?|$)/i.test(media?.url ?? '')
  return <div className={cn('overflow-hidden rounded-lg bg-muted flex items-center justify-center', className)}>
    {media?.url && !isVideo && !failed
      ? <img width={320} height={200} src={media.url} alt={post.text.slice(0, 70) || 'Vista previa del contenido'} loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      : <ImageIcon className="h-5 w-5 text-muted-foreground/50" />}
  </div>
}
function PostCard({ post, onOpen, compact = false }: { post: PublishedPost; onOpen: () => void; compact?: boolean }) {
  const wall = calendarPostDate(post)
  const time = wall.slice(11, 16)
  return <button type="button" onClick={onOpen} className={cn('w-full rounded-xl border border-border/60 bg-card p-2 text-left transition hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', compact && 'flex gap-3 p-3')}>
    {compact && <Thumbnail post={post} className="h-16 w-16 shrink-0" />}
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px]">
        {post.platforms.map(p => <span key={p} className={cn('font-semibold capitalize', platforms[p] ?? 'text-muted-foreground')}>{p}</span>)}
        <span className="text-muted-foreground">{time}</span>
      </div>
      {!compact && <Thumbnail post={post} className="h-16 w-full" />}
      <p className="line-clamp-2 text-xs font-medium leading-relaxed">{post.text || 'Sin caption'}</p>
      <p className="truncate text-[10px] text-muted-foreground">{post.clientName ?? 'Contenido'}</p>
      <StateBadge post={post} />
    </div>
  </button>
}
export function ContentCalendar({ clients }: { clients: Client[] }) {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [anchor, setAnchor] = useState(() => new Date(`${puertoRicoNow().slice(0, 10)}T12:00:00`))
  const [blogId, setBlogId] = useState('all')
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<PublishedPost | null>(null)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = view === 'month' ? addDays(monthStart, -monthStart.getDay()) : addDays(anchor, -anchor.getDay())
  const last = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : addDays(start, 6)
  const end = view === 'month' ? addDays(last, 6 - last.getDay()) : last
  const startKey = dateKey(start), endKey = dateKey(end)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null); setPosts([]); setExpandedDays({})
    const params = new URLSearchParams({ startDate: dateKey(addDays(new Date(`${startKey}T12:00:00`), -1)), endDate: dateKey(addDays(new Date(`${endKey}T12:00:00`), 1)), includeDrafts: 'true' })
    params.set(blogId === 'all' ? 'all' : 'blogId', blogId === 'all' ? 'true' : blogId)
    fetch(`/api/metricool/posts?${params}`, { signal: controller.signal })
      .then(async res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => { if (!controller.signal.aborted) setPosts(data.posts ?? []) })
      .catch(() => { if (!controller.signal.aborted) setError('No se pudo cargar el calendario. Intenta actualizar.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [blogId, startKey, endKey, refresh])
  const visiblePosts = useMemo(() => posts.filter(p => {
    const day = calendarPostDate(p).slice(0, 10)
    return day >= startKey && day <= endKey
  }).sort((a, b) => calendarPostDate(a).localeCompare(calendarPostDate(b))), [posts, startKey, endKey])
  const now = puertoRicoNow()
  const today = now.slice(0, 10)
  const upcoming = visiblePosts.filter(p => calendarPostState(p) === 'scheduled' && calendarPostDate(p) >= now)
  const days: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  function navigate(direction: number) {
    setAnchor(d => view === 'month' ? new Date(d.getFullYear(), d.getMonth() + direction, 1) : addDays(d, direction * 7))
  }
  const title = view === 'month' ? anchor.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' }) : `${start.toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' })}`
  return <section aria-label="Calendario de publicaciones" className="space-y-5 rounded-2xl border bg-card/40 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
      <div className="min-w-0"><h2 className="text-xl font-semibold tracking-tight">Calendario de publicaciones</h2><p className="mt-1 text-xs text-muted-foreground">Tu contenido, fechas y redes en un solo lugar · Hora de Puerto Rico</p></div>
      <Button asChild variant="outline" size="sm"><Link href="/published">Ver contenido <ArrowUpRight className="h-4 w-4" /></Link></Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Select value={blogId} onValueChange={setBlogId}><SelectTrigger aria-label="Filtrar por cliente" className="w-full sm:w-[220px]"><SelectValue placeholder="Todos los clientes" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los clientes</SelectItem>{clients.filter(c => c.metricool_blog_id).map(c => <SelectItem key={c.id} value={c.metricool_blog_id!}>{c.name}</SelectItem>)}</SelectContent></Select>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date(`${puertoRicoNow().slice(0, 10)}T12:00:00`))}>Hoy</Button>
        <Button aria-label="Período anterior" variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button aria-label="Período siguiente" variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="flex rounded-lg border bg-muted/40 p-1">{(['month', 'week'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={cn('rounded-md px-3 py-1.5 text-xs font-medium', view === v ? 'bg-primary/15 text-primary' : 'text-muted-foreground')}>{v === 'month' ? 'Mes' : 'Semana'}</button>)}</div>
        <Button aria-label="Actualizar calendario" variant="ghost" size="icon" disabled={loading} onClick={() => setRefresh(r => r + 1)}><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></Button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-3"><h3 className="text-lg font-semibold capitalize">{title}</h3>
        {!loading && !error && visiblePosts.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No hay publicaciones en este período.</p>}
        <div className="overflow-x-auto rounded-xl border"><div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b bg-muted/30">{dayLabels.map(d => <div key={d} className="py-3 text-center text-xs font-medium text-muted-foreground">{d}</div>)}</div>
          <div className="grid grid-cols-7">{days.map(day => {
            const date = dateKey(day), dayPosts = visiblePosts.filter(p => calendarPostDate(p).startsWith(date))
            const shown = expandedDays[date] ? dayPosts : dayPosts.slice(0, 2)
            return <div key={date} className={cn('min-h-[170px] border-b border-r border-border/70 p-2 space-y-2', day.getMonth() !== anchor.getMonth() && view === 'month' ? 'bg-muted/20' : 'bg-background/40', date === today && 'bg-primary/5')}>
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs', date === today ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground')}>{day.getDate()}</span>
              {loading ? <Skeleton className="h-20 rounded-lg" /> : shown.map(p => <PostCard key={key(p)} post={p} onOpen={() => setSelected(p)} />)}
              {dayPosts.length > 2 && <button onClick={() => setExpandedDays(s => ({ ...s, [date]: !s[date] }))} className="px-1 text-xs text-primary">{expandedDays[date] ? 'Ver menos' : `+${dayPosts.length - 2} más`}</button>}
            </div>
          })}</div>
        </div></div>
      </div>
      <aside className="space-y-5 xl:pt-10">
        <div className="rounded-xl border bg-background/40 p-4 space-y-3"><h3 className="text-sm font-semibold">Próximas publicaciones</h3><p className="text-[11px] text-muted-foreground">En el período seleccionado</p>
          {loading ? <Skeleton className="h-24" /> : !error && (upcoming.length ? upcoming.slice(0, 4).map(p => <div key={key(p)} className="space-y-1"><p className="text-[10px] text-muted-foreground">{calendarPostDate(p).slice(0, 10)}</p><PostCard post={p} compact onOpen={() => setSelected(p)} /></div>) : <p className="py-5 text-xs text-muted-foreground">Sin publicaciones programadas próximas.</p>)}
        </div>
        <div className="rounded-xl border bg-background/40 p-4 space-y-3"><h3 className="text-sm font-semibold">Estado del contenido</h3>{Object.entries(states).map(([state, info]) => <div key={state} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', info.color)} />{info.label}</span><span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{loading || error ? '—' : visiblePosts.filter(p => calendarPostState(p) === state).length}</span></div>)}</div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><CalendarDays className="mb-3 h-5 w-5 text-primary" /><p className="text-sm font-medium">Cada publicación tiene su momento.</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Abre una tarjeta para revisar el caption, las redes y el estado de Metricool.</p></div>
      </aside>
    </div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.clientName ?? 'Detalle de publicación'}</DialogTitle><DialogDescription>{selected && `${calendarPostDate(selected).replace('T', ' · ')} · Puerto Rico`}</DialogDescription></DialogHeader>{selected && <div className="space-y-4"><StateBadge post={selected} /><p className="text-xs capitalize text-muted-foreground">{selected.platforms.join(' · ')}</p><Thumbnail post={selected} className="h-56 w-full" /><p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.text || 'Sin caption'}</p><Button asChild variant="outline"><Link href="/published">Abrir contenido publicado</Link></Button></div>}</DialogContent></Dialog>
  </section>
}
