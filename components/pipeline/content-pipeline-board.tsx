'use client'

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, LayoutGrid, ChevronDown, ChevronLeft, ChevronRight, GripVertical, Users, X, Building2, Check, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { panScrollLeft, isPanDrag } from '@/lib/utils/drag-scroll'
import { BATCH_STAGES, ideaStage, adjacentBatchStage, batchProgress, type BatchStageKey } from '@/lib/utils/content-batches'
import { worstDeadlineStatus, deadlineTone } from '@/lib/utils/deadlines'
import { userAccent } from '@/lib/utils/user-accent'
import { moveBatch } from '@/lib/actions/content-ideas'
import { useToast } from '@/lib/hooks/use-toast'
import { useAuth } from '@/lib/context/auth-context'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { IdeaDetailSheet } from '@/components/clients/profile/idea-detail-sheet'
import { NewVideoDialog } from './new-video-dialog'
import type { PlannedSession } from '@/lib/utils/planned-sessions'
import type { IdeaWithPipeline, SocialPlatform, ContentIdeaType } from '@/lib/supabase/types'

type Idea = IdeaWithPipeline

/** A client's planned recording sessions, shown as empty-slot cards in Ideas. */
export interface PlannedClient {
  clientId: string
  clientName: string
  platforms?: SocialPlatform[]
  sessions: PlannedSession[]
}

const STAGE_DOT: Record<BatchStageKey, string> = {
  idea: '#3b82f6', title: '#64748b', caption: '#a855f7', video: '#06b6d4',
  edited: '#8b5cf6', approval: '#f59e0b', publication: '#10b981',
}

const TYPE_LABEL: Record<ContentIdeaType, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

/**
 * Global content pipeline — one card per VIDEO (idea), bucketed into the column
 * of its own pipeline stage. Wrapped in Suspense because the inner board reads
 * `useSearchParams()` (filters persisted in the URL) — Next requires a boundary.
 */
export function ContentPipelineBoard(props: { ideas: Idea[]; plannedClients?: PlannedClient[] }) {
  return (
    <Suspense fallback={null}>
      <ContentPipelineBoardInner {...props} />
    </Suspense>
  )
}

function ContentPipelineBoardInner({ ideas, plannedClients = [] }: { ideas: Idea[]; plannedClients?: PlannedClient[] }) {
  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  // Filters persist in the URL (?cliente=&persona=) so a filtered board is
  // bookmarkable/shareable and survives navigation back to /pipeline.
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [clientFilter, setClientFilter] = useState<string | null>(() => searchParams?.get('cliente') ?? null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(() => searchParams?.get('persona') ?? null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (clientFilter) params.set('cliente', clientFilter)
    if (assigneeFilter) params.set('persona', assigneeFilter)
    const qs = params.toString()
    const desired = qs ? `${pathname}?${qs}` : pathname
    const currentQs = searchParams?.toString() ?? ''
    const current = currentQs ? `${pathname}?${currentQs}` : pathname
    if (desired !== current) router.replace(desired, { scroll: false })
  }, [clientFilter, assigneeFilter, pathname, router, searchParams])

  // Optimistic per-video stage overrides (keyed by idea id).
  const [overrides, setOverrides] = useState<Record<string, BatchStageKey>>({})
  const [, startMove] = useTransition()
  const { toast } = useToast()

  // Per-video detail sheet (opened in place on card click, no navigation).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const openVideo = useCallback((id: string) => setSelectedId(id), [])

  // Active (non-discarded) videos are the board's unit of work.
  const videos = useMemo(() => ideas.filter((i) => i.status !== 'descartada'), [ideas])

  const clients = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of videos) {
      const id = i.client?.id ?? i.client_id
      if (id) m.set(id, i.client?.name ?? 'Sin cliente')
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [videos])
  const clientCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const i of videos) {
      const id = i.client?.id ?? i.client_id
      if (id) m[id] = (m[id] ?? 0) + 1
    }
    return m
  }, [videos])
  const team = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>()
    for (const i of videos) {
      const a = i.assignee
      if (a) m.set(a.id, { id: a.id, name: a.full_name ?? '—' })
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [videos])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return videos.filter((i) => {
      const cid = i.client?.id ?? i.client_id
      if (clientFilter && cid !== clientFilter) return false
      if (assigneeFilter && i.assignee?.id !== assigneeFilter) return false
      if (q && !(`${i.title ?? ''} ${i.hook ?? ''} ${i.client?.name ?? ''} ${i.assignee?.full_name ?? ''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [videos, clientFilter, assigneeFilter, search])

  // Planned (empty-slot) cards obey the same filters: hidden under an assignee
  // filter (they're unassigned), and scoped to the chosen client.
  const visiblePlanned = useMemo(() => {
    if (assigneeFilter) return []
    const q = search.trim().toLowerCase()
    return plannedClients.filter((p) => {
      if (clientFilter && p.clientId !== clientFilter) return false
      if (q && !p.clientName.toLowerCase().includes(q)) return false
      return true
    })
  }, [plannedClients, clientFilter, assigneeFilter, search])

  const hasFilter = !!clientFilter || !!assigneeFilter || search.trim().length > 0
  const emptyFiltered = hasFilter && visible.length === 0 && visiblePlanned.length === 0
  const clearFilters = useCallback(() => {
    setClientFilter(null)
    setAssigneeFilter(null)
    setSearch('')
  }, [])

  const stageOf = useCallback((i: Idea) => overrides[i.id] ?? ideaStage(i), [overrides])

  const byStage = useMemo(() => {
    const out = { idea: [], title: [], caption: [], video: [], edited: [], approval: [], publication: [] } as Record<BatchStageKey, Idea[]>
    for (const i of visible) out[stageOf(i)].push(i)
    return out
  }, [visible, stageOf])

  const moveCard = useCallback(
    (vid: Idea, dir: 1 | -1) => {
      const cur = stageOf(vid)
      const target = adjacentBatchStage(cur, dir)
      if (!target) return
      setOverrides((o) => ({ ...o, [vid.id]: target }))
      startMove(async () => {
        const res = await moveBatch([vid.id], target)
        if (res?.error) {
          setOverrides((o) => ({ ...o, [vid.id]: cur }))
          toast({ title: 'No se pudo mover el video', description: res.error, variant: 'destructive' })
        }
      })
    },
    [stageOf, toast],
  )

  const published = visible.filter((i) => stageOf(i) === 'publication').length

  // ── Click-and-drag horizontal panning of the columns (grab/grabbing cursor) ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const pan = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 })
  const [grabbing, setGrabbing] = useState(false)

  const onPanDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    pan.current = { active: true, moved: false, startX: e.clientX, scrollLeft: el.scrollLeft }
  }, [])
  const onPanMove = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el || !pan.current.active) return
    if (!pan.current.moved && !isPanDrag(pan.current.startX, e.clientX)) return
    pan.current.moved = true
    setGrabbing(true)
    el.scrollLeft = panScrollLeft(pan.current.scrollLeft, pan.current.startX, e.clientX)
  }, [])
  const endPan = useCallback(() => {
    pan.current.active = false
    setGrabbing(false)
    if (pan.current.moved && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => { pan.current.moved = false })
    }
  }, [])
  const onPanClickCapture = useCallback((e: React.MouseEvent) => {
    if (pan.current.moved) {
      e.stopPropagation()
      e.preventDefault()
      pan.current.moved = false
    }
  }, [])

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-[13px] font-bold text-black shadow-lg shadow-primary/20">N</div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">Content Pipeline</h1>
            <p className="text-[11px] text-muted-foreground">Nate Media · videos individuales</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar videos, clientes, personas…" className="h-8 w-52 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none" />
          </div>
          <ClientFilterDropdown clients={clients} counts={clientCounts} total={videos.length} value={clientFilter} onChange={setClientFilter} />
          <HeaderButton icon={Filter} label="Filtros" />
          <HeaderButton icon={LayoutGrid} label="Agrupar" trailing={ChevronDown} />
          <NewVideoDialog clients={clients} />
        </div>
      </header>

      {/* Assignee filter — color = person · with video/publicados stats on the right */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80"><Users className="h-3.5 w-3.5" /> Asignado a</span>
        <button onClick={() => setAssigneeFilter(null)} className={cn('rounded-full border px-3 py-1 text-[11px] font-medium transition', assigneeFilter === null ? 'border-white/20 bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60')}>Todos</button>
        {currentUserId && (
          <button
            onClick={() => setAssigneeFilter((cur) => (cur === currentUserId ? null : currentUserId))}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition',
              assigneeFilter === currentUserId
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/60',
            )}
          >
            <Check className="h-3 w-3" /> Mis videos
          </button>
        )}
        {team.map((p) => {
          const a = userAccent(p.id)
          const on = assigneeFilter === p.id
          return (
            <button key={p.id} onClick={() => setAssigneeFilter(on ? null : p.id)} className={cn('inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[11px] transition', on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')} style={{ borderColor: on ? a.dot : 'rgba(255,255,255,0.06)', backgroundColor: on ? a.soft : 'transparent' }}>
              <span className="grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] font-bold text-black" style={{ backgroundColor: a.dot }}>{p.name.slice(0, 1).toUpperCase()}</span>
              {p.name}
            </button>
          )
        })}
        <p className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          <span className="text-foreground">{visible.length}</span> videos · <span className="text-emerald-400">{published}</span> publicados
        </p>
      </div>

      {/* Columns — drag anywhere on the board to pan horizontally (grab cursor).
          Keyboard: the region is focusable and arrow keys scroll it. */}
      <div
        ref={scrollRef}
        data-testid="pipeline-scroll"
        tabIndex={0}
        role="group"
        aria-label="Tablero del pipeline — usa las flechas para desplazar las columnas"
        onMouseDown={onPanDown}
        onMouseMove={onPanMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        onClickCapture={onPanClickCapture}
        onKeyDown={(e) => {
          const el = scrollRef.current
          if (!el) return
          const step = 320
          if (e.key === 'ArrowRight') { el.scrollLeft += step; e.preventDefault() }
          else if (e.key === 'ArrowLeft') { el.scrollLeft -= step; e.preventDefault() }
          else if (e.key === 'Home') { el.scrollLeft = 0; e.preventDefault() }
          else if (e.key === 'End') { el.scrollLeft = el.scrollWidth; e.preventDefault() }
        }}
        className={cn('flex-1 overflow-x-auto overflow-y-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/40', grabbing ? 'cursor-grabbing select-none' : 'cursor-grab')}
      >
        {emptyFiltered ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {assigneeFilter === currentUserId && currentUserId ? 'No tienes videos asignados con estos filtros' : 'Ningún video coincide con los filtros'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Ajusta o quita los filtros para ver más.</p>
            </div>
            <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted">
              <X className="h-3.5 w-3.5" /> Quitar filtros
            </button>
          </div>
        ) : (
          <div className="flex h-full min-w-max gap-3 p-4">
            {BATCH_STAGES.map((stage) => (
              <VideoColumn key={stage.key} stageKey={stage.key} label={stage.label} videos={byStage[stage.key]} planned={stage.key === 'idea' ? visiblePlanned : undefined} onMove={moveCard} onOpen={openVideo} />
            ))}
          </div>
        )}
      </div>

      {/* Per-video detail sheet */}
      <IdeaDetailSheet ideaId={selectedId} open={selectedId !== null} onOpenChange={(o) => { if (!o) setSelectedId(null) }} />
    </div>
  )
}

function VideoColumn({ stageKey, label, videos, planned, onMove, onOpen }: { stageKey: BatchStageKey; label: string; videos: Idea[]; planned?: PlannedClient[]; onMove: (v: Idea, dir: 1 | -1) => void; onOpen: (id: string) => void }) {
  const plannedCards = (planned ?? []).flatMap((p) => p.sessions.map((s) => ({ client: p, session: s })))
  const count = videos.length + plannedCards.length
  return (
    <section className="flex h-full w-[284px] flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_DOT[stageKey] }} />
          <h2 className="text-[12px] font-semibold tracking-tight">{label}</h2>
          <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">{count}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto rounded-lg bg-muted/30 p-2">
        {count === 0 ? (
          <p className="select-none py-6 text-center text-[11px] text-muted-foreground/40">—</p>
        ) : (
          <>
            {plannedCards.map(({ client, session }) => (
              <PlannedSessionCard key={`${client.clientId}-${session.index}`} client={client} session={session} />
            ))}
            {videos.map((v) => <VideoCard key={v.id} video={v} stage={stageKey} onMove={onMove} onOpen={onOpen} />)}
          </>
        )}
      </div>
    </section>
  )
}

/** Visual-only card: a planned recording session with empty slots waiting for ideas. */
function PlannedSessionCard({ client, session }: { client: PlannedClient; session: PlannedSession }) {
  const slots = Math.min(session.total, 24) // cap the drawn boxes; count stays exact
  return (
    <article
      className="group relative overflow-hidden rounded-xl border border-dashed border-border bg-card"
      style={{ boxShadow: 'inset 3px 0 0 0 #3b82f6' }}
    >
      <div className="space-y-2.5 p-3 pl-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-[12px] font-bold text-muted-foreground">{client.clientName.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{client.clientName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{session.label} · {session.total} video{session.total === 1 ? '' : 's'}</p>
          </div>
          <span className="shrink-0 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/80">Planificado</span>
        </div>

        {/* empty slot grid (visual placeholders, no DB rows) */}
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: slots }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-6 rounded-[5px] border',
                i < session.filled ? 'border-transparent bg-cyan-500/30' : 'border-dashed border-border bg-muted/40',
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5">
            {client.platforms && client.platforms.length > 0 && <PlatformBadges platforms={client.platforms.slice(0, 4)} />}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {session.empty > 0 ? `${session.empty} por idear` : 'Lleno'}
          </span>
        </div>
      </div>
    </article>
  )
}

const VideoCard = memo(function VideoCard({ video, stage, onMove, onOpen }: { video: Idea; stage: BatchStageKey; onMove: (v: Idea, dir: 1 | -1) => void; onOpen: (id: string) => void }) {
  const a = userAccent(video.assignee?.id)
  const canBack = adjacentBatchStage(stage, -1) !== null
  const canFwd = adjacentBatchStage(stage, 1) !== null
  const pct = Math.round(batchProgress(stage) * 100)

  const dl = worstDeadlineStatus([video])
  const dlt = deadlineTone(dl)

  const clientName = video.client?.name ?? 'Sin cliente'
  const title = video.title?.trim() || video.hook?.trim() || 'Sin título'
  const platforms = (video.client?.platforms ?? []) as SocialPlatform[]

  return (
    <article onClick={() => onOpen(video.id)} className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-foreground/20 hover:bg-muted" style={{ boxShadow: 'inset 3px 0 0 0 ' + a.dot }}>
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <MoveBtn dir={-1} disabled={!canBack} onClick={(e) => { e.stopPropagation(); onMove(video, -1) }} />
        <MoveBtn dir={1} disabled={!canFwd} onClick={(e) => { e.stopPropagation(); onMove(video, 1) }} />
      </div>

      <div className="space-y-2.5 p-3 pl-3.5">
        {/* type + deadline */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{TYPE_LABEL[video.content_type] ?? video.content_type}</span>
          {dlt.label && (
            <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none whitespace-nowrap', dlt.className)}>
              <Flag className="h-2.5 w-2.5" aria-hidden />
              {dlt.label}
            </span>
          )}
          <GripVertical className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        </div>

        {/* title */}
        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">{title}</p>

        {/* client */}
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-bold text-black" style={{ backgroundColor: a.dot }}>{clientName.slice(0, 1).toUpperCase()}</span>
          <p className="truncate text-[11px] font-medium text-muted-foreground">{clientName}</p>
        </div>

        {/* progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">En el pipeline</span>
            <span className="font-semibold tabular-nums" style={{ color: a.text }}>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: a.dot }} />
          </div>
        </div>

        {/* footer: platforms + assignee */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5">
            {platforms.length > 0 && <PlatformBadges platforms={platforms.slice(0, 4)} />}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">{video.assignee?.full_name ?? 'Sin asignar'}</span>
            <span className="grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] font-bold text-black" style={{ backgroundColor: a.dot }}>{(video.assignee?.full_name ?? '?').slice(0, 1).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </article>
  )
})

function MoveBtn({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: (e: React.MouseEvent) => void }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft
  return (
    <button onClick={onClick} disabled={disabled} aria-label={dir === 1 ? 'Mover video adelante' : 'Mover video atrás'} className="grid h-5 w-5 place-items-center rounded border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

/** Compact, searchable client filter — replaces the old wrapping chip row. */
function ClientFilterDropdown({
  clients,
  counts,
  total,
  value,
  onChange,
}: {
  clients: { id: string; name: string }[]
  counts: Record<string, number>
  total: number
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = value ? clients.find((c) => c.id === value) ?? null : null
  const label = selected ? selected.name : 'Todos los clientes'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients
  }, [clients, query])

  function choose(id: string | null) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-md border px-2.5 text-xs transition',
          value
            ? 'border-primary/40 bg-primary/10 text-foreground'
            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-60 transition', open && 'rotate-180')} />
      </button>

      {value && (
        <button
          type="button"
          aria-label="Quitar filtro de cliente"
          onClick={() => choose(null)}
          className="ml-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente…"
              className="h-8 w-full rounded-md border border-border bg-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto p-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => choose(null)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition',
                  value === null ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2">
                  {value === null ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3b82f6]" />}
                  Todos los clientes
                </span>
                <span className="shrink-0 tabular-nums opacity-60">{total}</span>
              </button>
            </li>
            {filtered.map((c) => {
              const on = value === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => choose(c.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition',
                      on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {on ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />}
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums opacity-60">{counts[c.id] ?? 0}</span>
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="px-2.5 py-3 text-center text-[11px] text-muted-foreground/60">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function HeaderButton({ icon: Icon, label, trailing: Trailing }: { icon: typeof Filter; label: string; trailing?: typeof ChevronDown }) {
  return (
    <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
      {Trailing && <Trailing className="h-3 w-3 opacity-60" />}
    </button>
  )
}
