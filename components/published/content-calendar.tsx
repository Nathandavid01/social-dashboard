'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarUploadDialog, type CalendarClient, type CalendarUploadSaved } from './calendar-upload-dialog'
import { CalendarPostControls, type CalendarStateChange } from './calendar-post-controls'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, ImageIcon, ArrowUpRight } from 'lucide-react'
import type { PublishedPost } from '@/app/api/metricool/posts/route'
import { calendarPostDate, calendarPostState, puertoRicoNow, type CalendarPostState } from '@/lib/published/calendar-post'
import { cn } from '@/lib/utils'
import styles from './content-calendar.module.css'

type Client = CalendarClient
const states: Record<CalendarPostState, { label: string; color: string }> = {
  scheduled: { label: 'Programado', color: 'bg-violet-500/15 text-violet-600' },
  draft: { label: 'Borrador', color: 'bg-amber-500/15 text-amber-700' },
  published: { label: 'Publicado', color: 'bg-emerald-500/15 text-emerald-700' },
  error: { label: 'Error', color: 'bg-red-500/15 text-red-600' },
  partial: { label: 'Publicación parcial', color: 'bg-orange-500/15 text-orange-700' },
  unknown: { label: 'Sin confirmar', color: 'bg-muted text-muted-foreground' },
}
const platforms: Record<string, string> = { instagram: 'text-pink-600', facebook: 'text-blue-600', tiktok: 'text-cyan-700', youtube: 'text-red-600' }
const dayLabels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const key = (p: PublishedPost) => `${p.blogId}:${p.clientId ?? ''}:${p.id}`
function StateBadge({ post }: { post: PublishedPost }) {
  const state = states[calendarPostState(post)]
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', state.color)}>{state.label}</span>
}
function Thumbnail({ post, className, playable = false }: { post: PublishedPost; className?: string; playable?: boolean }) {
  const [failed, setFailed] = useState(false)
  const media = post.media?.[0]
  const isVideo = media?.type?.toLowerCase().includes('video') || /\.(mp4|mov|webm)(?:\?|$)/i.test(media?.url ?? '')
  return <div className={cn('overflow-hidden rounded-lg bg-muted flex items-center justify-center', className)}>
    {media?.url && isVideo && !failed
      ? <video src={media.url} muted={!playable} controls={playable} preload="metadata" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      : media?.url && !isVideo && !failed
      ? <img width={320} height={200} src={media.url} alt={post.text.slice(0, 70) || 'Vista previa del contenido'} loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      : <ImageIcon className="h-5 w-5 text-muted-foreground/50" />}
  </div>
}
function PostCard({ post, onOpen, compact = false }: { post: PublishedPost; onOpen: () => void; compact?: boolean }) {
  const wall = calendarPostDate(post)
  const time = wall.slice(11, 16)
  return <button type="button" onClick={onOpen} className={cn('w-full text-left transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', compact ? 'flex gap-3 rounded-xl border border-border bg-card p-3' : 'rounded-lg p-1')}>
    {compact && <Thumbnail post={post} className="h-20 w-20 shrink-0" />}
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px]">
        {post.platforms.map(p => <span key={p} className={cn('font-semibold capitalize', platforms[p] ?? 'text-muted-foreground')}>{p}</span>)}
        <span className="text-muted-foreground">{compact && `${new Date(`${wall.slice(0, 10)}T12:00:00`).toLocaleDateString('es-PR', { day: 'numeric', month: 'short' })} · `}{time}</span>
      </div>
      {!compact && <Thumbnail post={post} className="h-16 w-full" />}
      <p className="line-clamp-2 text-xs font-medium leading-relaxed">{post.text || 'Sin caption'}</p>
      <p className="truncate text-[10px] text-muted-foreground">{post.clientName ?? 'Contenido'}</p>
      <StateBadge post={post} />
    </div>
  </button>
}
export function ContentCalendar({ clients, clientId }: { clients: Client[]; clientId?: string }) {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [anchor, setAnchor] = useState(() => new Date(`${puertoRicoNow().slice(0, 10)}T12:00:00`))
  const [clientFilter, setClientFilter] = useState(clientId ?? 'all')
  const activeClientId = clientId ?? clientFilter
  const activeClient = clients.find(c => c.id === activeClientId)
  const [posts, setPosts] = useState<PublishedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [failedClients, setFailedClients] = useState<{ id: string; name: string }[]>([])
  const [calendarBusy, setCalendarBusy] = useState(false)
  const mutationInFlight = useRef(false)
  const inFlight = useRef(false)
  const lastScope = useRef('')
  const lastAttempt = useRef(0)
  const [refresh, setRefresh] = useState(0)
  const [stateFilter, setStateFilter] = useState<CalendarPostState | 'all'>('all')
  const [upcomingOpen, setUpcomingOpen] = useState(false)
  const [selected, setSelected] = useState<PublishedPost | null>(null)
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = view === 'month' ? addDays(monthStart, -monthStart.getDay()) : addDays(anchor, -anchor.getDay())
  const last = view === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) : addDays(start, 6)
  const end = view === 'month' ? addDays(last, 6 - last.getDay()) : last
  const startKey = dateKey(start), endKey = dateKey(end)
  useEffect(() => {
    const controller = new AbortController()
    const scope = `${activeClientId}:${startKey}:${endKey}`
    if (lastScope.current !== scope) {
      setPosts([]); setExpandedDays({}); setCheckedAt(null); setFailedClients([]); setSelected(null)
      lastScope.current = scope
    }
    inFlight.current = true; lastAttempt.current = Date.now()
    setLoading(true); setError(null)
    const params = new URLSearchParams({ startDate: dateKey(addDays(new Date(`${startKey}T12:00:00`), -1)), endDate: dateKey(addDays(new Date(`${endKey}T12:00:00`), 1)), includeDrafts: 'true' })
    if (activeClientId === 'all') params.set('all', 'true')
    else params.set('clientId', activeClientId)
    if (activeClientId !== 'all' && !activeClient?.metricool_blog_id) { setLoading(false); inFlight.current = false; return () => controller.abort() }
    fetch(`/api/metricool/posts?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async res => { if (!res.ok) throw new Error(); return res.json() })
      .then(data => {
        if (controller.signal.aborted) return
        setPosts(data.posts ?? []); setCheckedAt(data.checkedAt ?? null); setFailedClients(data.failedClients ?? [])
      })
      .catch(() => { if (!controller.signal.aborted) setError('No se pudo verificar Metricool. Los datos anteriores no están confirmados; intenta nuevamente.') })
      .finally(() => { if (!controller.signal.aborted) { inFlight.current = false; setLoading(false) } })
    return () => { controller.abort(); inFlight.current = false }
  }, [activeClientId, activeClient?.metricool_blog_id, startKey, endKey, refresh])
  useEffect(() => {
    const verify = () => {
      if (document.visibilityState !== 'hidden' && !inFlight.current && !mutationInFlight.current && Date.now() - lastAttempt.current >= 60_000) setRefresh(r => r + 1)
    }
    const timer = window.setInterval(verify, 60_000)
    document.addEventListener('visibilitychange', verify)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', verify) }
  }, [])
  // Open details follow the latest Metricool result instead of a stale copy.
  const selectedPost = selected ? posts.find(p => key(p) === key(selected)) ?? null : null
  const visiblePosts = useMemo(() => posts.filter(p => {
    const day = calendarPostDate(p).slice(0, 10)
    return day >= startKey && day <= endKey
  }).sort((a, b) => calendarPostDate(a).localeCompare(calendarPostDate(b))), [posts, startKey, endKey])
  const now = puertoRicoNow()
  const today = now.slice(0, 10)
  const filteredPosts = visiblePosts.filter(p => stateFilter === 'all' || calendarPostState(p) === stateFilter)
  const upcoming = filteredPosts.filter(p => calendarPostState(p) === 'scheduled' && calendarPostDate(p) >= now)
  const attention = visiblePosts.filter(p => ['partial', 'error'].includes(calendarPostState(p)) || (calendarPostState(p) === 'scheduled' && calendarPostDate(p) < now))
  const days: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  function onPostChanged(result: CalendarStateChange) {
    setSelected(null); setStateFilter('all')
    if (result.confirmed && result.action === 'schedule' && result.dateTime) setAnchor(new Date(`${result.dateTime.slice(0, 10)}T12:00:00`))
    setRefresh(r => r + 1)
  }
  function onUploaded(result: CalendarUploadSaved) {
    if (!clientId) setClientFilter(result.clientId)
    setAnchor(new Date(`${result.dateTime.slice(0, 10)}T12:00:00`))
    setStateFilter('all'); setRefresh(r => r + 1)
  }
  function navigate(direction: number) {
    setAnchor(d => view === 'month' ? new Date(d.getFullYear(), d.getMonth() + direction, 1) : addDays(d, direction * 7))
  }
  const title = view === 'month' ? anchor.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' }) : `${start.toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' })}`
  return <section aria-label="Calendario de publicaciones" className={cn(styles.theme, 'space-y-5 rounded-2xl border bg-[#fcfcff] p-4 sm:p-6')}>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
      <div className="min-w-0"><h2 className="text-xl font-semibold tracking-tight">{clientId && activeClient ? `Calendario de ${activeClient.name}` : 'Calendario de publicaciones'}</h2><p className="mt-1 text-xs text-muted-foreground">Tu contenido, fechas y redes en un solo lugar · Hora de Puerto Rico</p></div>
      <div className="flex flex-wrap items-center gap-2"><CalendarUploadDialog clients={clients} clientId={activeClientId === 'all' ? undefined : activeClientId} initialDateTime={`${dateKey(anchor)}T12:00`} onSaved={onUploaded} onVerify={onUploaded} onBusy={busy => { mutationInFlight.current = busy; setCalendarBusy(busy) }} /><Button asChild size="sm" variant="outline"><Link href="/published">Ver contenido <ArrowUpRight className="h-4 w-4" /></Link></Button></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      {!clientId && <Select value={clientFilter} onValueChange={setClientFilter} disabled={calendarBusy}><SelectTrigger aria-label="Filtrar por cliente" className="w-full sm:w-[220px]"><SelectValue placeholder="Todos los clientes" /></SelectTrigger><SelectContent className={styles.theme}><SelectItem value="all">Todos los clientes</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>}
      {activeClient && !clientId && <Link className="text-xs text-primary hover:underline" href={`/clients/${activeClient.id}/calendar`}>Abrir calendario de {activeClient.name} <ArrowUpRight className="inline h-3 w-3" /></Link>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={calendarBusy} onClick={() => setAnchor(new Date(`${puertoRicoNow().slice(0, 10)}T12:00:00`))}>Hoy</Button>
        <Button aria-label="Período anterior" variant="outline" size="icon" disabled={calendarBusy} onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button aria-label="Período siguiente" variant="outline" size="icon" disabled={calendarBusy} onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="flex rounded-lg border bg-muted/40 p-1">{(['month', 'week'] as const).map(v => <button key={v} disabled={calendarBusy} aria-pressed={view === v} onClick={() => setView(v)} className={cn('rounded-md px-3 py-1.5 text-xs font-medium', view === v ? 'bg-primary/15 text-primary' : 'text-muted-foreground')}>{v === 'month' ? 'Mes' : 'Semana'}</button>)}</div>
        <Button aria-label="Verificar con Metricool" variant="outline" size="sm" disabled={loading || calendarBusy} onClick={() => setRefresh(r => r + 1)}><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Verificar</Button>
      </div>
    </div>
    <div aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className={cn('h-2 w-2 rounded-full', error || failedClients.length ? 'bg-amber-500' : checkedAt ? 'bg-emerald-500' : 'bg-muted-foreground')} />
      {loading ? 'Verificando con Metricool…' : error ? 'Verificación no disponible' : failedClients.length ? 'Verificación incompleta' : checkedAt ? `Verificado con Metricool · ${new Date(checkedAt).toLocaleTimeString('es-PR', { timeZone: 'America/Puerto_Rico', hour: 'numeric', minute: '2-digit', second: '2-digit' })}` : 'Esperando verificación de Metricool'}
      <span>· Actualización automática cada minuto con el calendario abierto</span>
    </div>
    {failedClients.length > 0 && !error && <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No se pudo verificar: {failedClients.map(c => c.name).join(', ')}. Los conteos están incompletos.</div>}
    {activeClient && !activeClient.metricool_blog_id && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Conecta {activeClient.name} con Metricool para ver sus publicaciones y subir contenido.</p>}
    {error && <div role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    <div className={styles.layout}>
      <div className="min-w-0 space-y-3">
        {!loading && !error && filteredPosts.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No hay publicaciones en este período.</p>}
        <div className="overflow-hidden rounded-xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-5"><h3 className="text-xl font-semibold">{title.charAt(0).toUpperCase() + title.slice(1)}</h3><span className="text-xs text-muted-foreground">{loading || error || failedClients.length ? '—' : filteredPosts.length} publicaciones</span></div><div className="overflow-x-auto"><div className="min-w-[560px]">
          <div className="grid grid-cols-7 border-b bg-muted/30">{dayLabels.map(d => <div key={d} className="py-3 text-center text-xs font-medium text-muted-foreground">{d}</div>)}</div>
          <div className="grid grid-cols-7">{days.map(day => {
            const date = dateKey(day), dayPosts = filteredPosts.filter(p => calendarPostDate(p).startsWith(date))
            const shown = expandedDays[date] ? dayPosts : dayPosts.slice(0, 2)
            return <div key={date} className={cn('min-h-[150px] border-b border-r border-border/70 p-2 space-y-2', day.getMonth() !== anchor.getMonth() && view === 'month' ? 'bg-muted/20' : 'bg-background/40', date === today && 'bg-primary/5')}>
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs', date === today ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground')}>{day.getDate()}</span>
              {loading ? <Skeleton className="h-20 rounded-lg" /> : shown.map(p => <PostCard key={key(p)} post={p} onOpen={() => setSelected(p)} />)}
              {dayPosts.length > 2 && <button onClick={() => setExpandedDays(s => ({ ...s, [date]: !s[date] }))} className="px-1 text-xs text-primary">{expandedDays[date] ? 'Ver menos' : `+${dayPosts.length - 2} más`}</button>}
            </div>
          })}</div>
        </div></div></div>
      </div>
      <aside aria-label="Menú de publicaciones" className={cn(styles.panel, 'space-y-5')}>
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Próximas publicaciones</h3><button onClick={() => setUpcomingOpen(true)} disabled={loading || !!error} className="inline-flex items-center gap-1 text-xs text-primary disabled:opacity-50">Ver todas <ArrowUpRight className="h-3.5 w-3.5" /></button></div>
          {loading ? <Skeleton className="h-24" /> : !error && (upcoming.length ? upcoming.slice(0, 3).map(p => <PostCard key={key(p)} post={p} compact onOpen={() => setSelected(p)} />) : <p className="py-5 text-xs text-muted-foreground">Sin publicaciones programadas próximas.</p>)}
        </div>
        <div className="rounded-xl border bg-white p-4 space-y-2"><h3 className="mb-3 text-sm font-semibold">Estado del contenido</h3>
          <button aria-pressed={stateFilter === 'all'} onClick={() => setStateFilter('all')} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs', stateFilter === 'all' && 'bg-accent text-primary')}><span>Todos los estados</span><span>{loading || error || failedClients.length ? '—' : visiblePosts.length}</span></button>
          {Object.entries(states).map(([state, info]) => <button aria-pressed={stateFilter === state} key={state} onClick={() => setStateFilter(state as CalendarPostState)} className={cn('flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs hover:bg-muted', stateFilter === state && 'bg-accent text-primary')}><span className="flex items-center gap-2"><span className={cn('h-3 w-3 rounded-full', info.color)} />{info.label}</span><span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{loading || error || failedClients.length ? '—' : visiblePosts.filter(p => calendarPostState(p) === state).length}</span></button>)}
        </div>
        {!loading && attention.length > 0 && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"><h3 className="text-sm font-semibold text-amber-900">Necesita atención</h3><p className="text-xs text-amber-800">Publicaciones parciales, errores o posts que siguen pendientes después de su hora.</p>{attention.slice(0, 3).map(p => <PostCard key={key(p)} post={p} compact onOpen={() => setSelected(p)} />)}</div>}
        <div className="rounded-xl bg-primary/5 p-5"><CalendarDays className="mb-4 h-6 w-6 text-primary" /><p className="text-sm font-medium">Cada publicación tiene su momento.</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Organiza tu contenido y revisa lo que viene para cada cliente.</p><div className="mt-5 h-px w-6 bg-primary" /><p className="mt-4 text-[11px] text-primary">Planea hoy. Publica con intención.</p></div>
      </aside>
    </div>
    <Dialog open={upcomingOpen} onOpenChange={setUpcomingOpen}><DialogContent className={cn(styles.theme, 'max-h-[85vh] overflow-y-auto')}><DialogHeader><DialogTitle>Próximas publicaciones</DialogTitle><DialogDescription>Publicaciones programadas en el período seleccionado · Hora de Puerto Rico</DialogDescription></DialogHeader><div className="space-y-3">{upcoming.length ? upcoming.map(p => <PostCard key={key(p)} post={p} compact onOpen={() => { setUpcomingOpen(false); setSelected(p) }} />) : <p className="text-sm text-muted-foreground">Sin publicaciones programadas próximas.</p>}</div></DialogContent></Dialog>
    <Dialog open={!!selectedPost} onOpenChange={open => { if (!open && !mutationInFlight.current) setSelected(null) }}><DialogContent className={cn(styles.theme, 'max-h-[85vh] overflow-y-auto')}><DialogHeader><DialogTitle>{selectedPost?.clientName ?? 'Detalle de publicación'}</DialogTitle><DialogDescription>{selectedPost && `${calendarPostDate(selectedPost).replace('T', ' · ')} · Puerto Rico`}</DialogDescription></DialogHeader>{selectedPost && <div className="space-y-4"><StateBadge post={selectedPost} /><p className="text-xs capitalize text-muted-foreground">{selectedPost.platforms.join(' · ')}</p><Thumbnail post={selectedPost} className="h-56 w-full" playable /><div className="space-y-2 rounded-xl border p-3"><h4 className="text-sm font-semibold">Verificación por red</h4>{(selectedPost.providers ?? selectedPost.platforms.map((network, i) => ({ network, status: selectedPost.providerStatuses?.[i] ?? 'UNKNOWN', detailedStatus: undefined, publicUrl: undefined }))).map((provider, i) => <div key={`${provider.network}:${i}`} className="space-y-1 border-b py-2 last:border-0"><p className="text-xs"><span className="font-semibold capitalize">{provider.network}</span> · {provider.status === 'PUBLISHED' ? 'Publicado' : provider.status === 'PENDING' ? 'Pendiente' : provider.status === 'ERROR' ? 'Error' : 'Sin confirmar'}</p>{provider.detailedStatus && provider.detailedStatus !== provider.status && <p className="text-xs text-muted-foreground">{provider.detailedStatus}</p>}{provider.status === 'PUBLISHED' && provider.publicUrl && /^https?:\/\//i.test(provider.publicUrl) && <a href={provider.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary">Ver publicación en {provider.network}<ArrowUpRight className="h-3 w-3" /></a>}</div>)}</div><p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedPost.text || 'Sin caption'}</p><CalendarPostControls key={`${key(selectedPost)}:${checkedAt}`} post={selectedPost} onChanged={onPostChanged} verifying={loading} onBusy={busy => { mutationInFlight.current = busy; setCalendarBusy(busy) }} onVerify={() => setRefresh(r => r + 1)} /><Button asChild variant="outline"><Link href="/published">Abrir contenido publicado</Link></Button></div>}</DialogContent></Dialog>
  </section>
}
