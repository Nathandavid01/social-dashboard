'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Search, Filter, LayoutGrid, Plus, ChevronDown, ChevronLeft, ChevronRight, GripVertical, Users, X, Building2, Check, Flag } from 'lucide-react'
import { cn, calendarDaysSince, formatDaysElapsedEs } from '@/lib/utils'
import { panScrollLeft, isPanDrag } from '@/lib/utils/drag-scroll'
import { worstDeadlineStatus, deadlineTone } from '@/lib/utils/deadlines'
import { BATCH_STAGES, groupIntoBatches, bucketBatches, adjacentBatchStage, batchProgress, buildClientPipelineIndex, STAGE_LABEL_ES, type BatchStageKey, type ClientBatch, type ClientCadence } from '@/lib/utils/content-batches'
import { userAccent } from '@/lib/utils/user-accent'
import { moveBatch } from '@/lib/actions/content-ideas'
import { getClientBatchData, type ClientBatchData, type ClientBatchOpenOptions } from '@/lib/actions/client-batch'
import { useToast } from '@/lib/hooks/use-toast'
import { ClientLogo } from '@/components/clients/client-logo'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { ClientBatchView } from '@/components/clients/batch/client-batch-view'
import { NewVideoDialog } from './new-video-dialog'
import type { PlannedSession } from '@/lib/utils/planned-sessions'
import type { IdeaWithPipeline, SocialPlatform } from '@/lib/supabase/types'

type Idea = IdeaWithPipeline

/** A client's planned recording sessions, shown as empty-slot cards in Ideas. */
export interface PlannedClient {
  clientId: string
  clientName: string
  logoUrl?: string | null
  /** When the client was created — days since onboarding. */
  createdAt?: string | null
  /** Last client update — proxy for when they entered this pipeline row. */
  inColumnSince?: string | null
  platforms?: SocialPlatform[]
  /** Pipeline column this planned slot is waiting in (always idea for now). */
  nextStage?: BatchStageKey
  /** Team member configured in settings for `nextStage`. */
  stepAssignee?: { id: string; name: string } | null
  sessions: PlannedSession[]
}

const STAGE_DOT: Record<BatchStageKey, string> = {
  idea: '#3b82f6', title: '#64748b', caption: '#a855f7', video: '#06b6d4',
  edited: '#8b5cf6', approval: '#f59e0b', publication: '#10b981',
}

/** Global content pipeline — one card per CLIENT BATCH, colored by its assignee. */
export function ContentPipelineBoard({
  ideas,
  plannedClients = [],
  allClients = [],
  clientCadence = {},
  teamMembers = [],
}: {
  ideas: Idea[]
  plannedClients?: PlannedClient[]
  /** Every active client — used by "Nuevo video" so you can pick any account. */
  allClients?: { id: string; name: string }[]
  clientCadence?: Record<string, ClientCadence>
  /** All active team members — powers the "Asignado a" filter (not just people on batches). */
  teamMembers?: { id: string; name: string }[]
}) {
  const [clientFilter, setClientFilter] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [overrides, setOverrides] = useState<Record<string, BatchStageKey>>({})
  const [, startMove] = useTransition()
  const { toast } = useToast()

  // In-place full-screen overlay of a client's batch view (no navigation).
  const [openClientId, setOpenClientId] = useState<string | null>(null)
  const [openOptions, setOpenOptions] = useState<ClientBatchOpenOptions | null>(null)
  const [batchData, setBatchData] = useState<ClientBatchData | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)

  const openClientBatch = useCallback(async (clientId: string, opts?: ClientBatchOpenOptions) => {
    setOpenClientId(clientId)
    setOpenOptions(opts ?? null)
    setBatchData(null)
    setBatchLoading(true)
    const data = await getClientBatchData(clientId, opts)
    setBatchData(data)
    setBatchLoading(false)
  }, [])
  const closeBatch = useCallback(() => {
    setOpenClientId(null)
    setOpenOptions(null)
    setBatchData(null)
  }, [])
  const refetchBatch = useCallback(async () => {
    if (!openClientId) return
    const data = await getClientBatchData(openClientId, openOptions ?? undefined)
    setBatchData(data)
  }, [openClientId, openOptions])

  const batches = useMemo(() => groupIntoBatches(ideas), [ideas])

  const pipelineByClient = useMemo(
    () => buildClientPipelineIndex(ideas, clientCadence),
    [ideas, clientCadence],
  )

  const clients = useMemo(
    () => batches.map((b) => ({ id: b.clientId, name: b.clientName })).sort((a, b) => a.name.localeCompare(b.name)),
    [batches],
  )
  const clientCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const b of batches) m[b.clientId] = (m[b.clientId] ?? 0) + 1
    return m
  }, [batches])
  const team = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>()
    for (const p of teamMembers) m.set(p.id, p)
    for (const b of batches) if (b.assignee && !m.has(b.assignee.id)) m.set(b.assignee.id, b.assignee)
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [batches, teamMembers])
  const assigneeCounts = useMemo(() => {
    const m: Record<string, number> = { unassigned: 0 }
    for (const b of batches) {
      if (b.assignee?.id) m[b.assignee.id] = (m[b.assignee.id] ?? 0) + 1
      else m.unassigned += 1
    }
    return m
  }, [batches])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return batches.filter((b) => {
      if (clientFilter && b.clientId !== clientFilter) return false
      if (assigneeFilter === 'unassigned') {
        if (b.assignee) return false
      } else if (assigneeFilter && b.assignee?.id !== assigneeFilter) return false
      if (q && !(`${b.clientName} ${b.assignee?.name ?? ''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [batches, clientFilter, assigneeFilter, search])

  const visiblePlanned = useMemo(() => {
    if (!assigneeFilter) return plannedClients
    if (assigneeFilter === 'unassigned') return plannedClients.filter((p) => !p.stepAssignee)
    return plannedClients.filter((p) => p.stepAssignee?.id === assigneeFilter)
  }, [plannedClients, assigneeFilter])

  const stageOf = useCallback((b: ClientBatch) => overrides[b.clientId] ?? b.stage, [overrides])

  const byStage = useMemo(() => {
    const out = { idea: [], title: [], caption: [], video: [], edited: [], approval: [], publication: [] } as Record<BatchStageKey, ClientBatch[]>
    for (const b of visible) out[stageOf(b)].push(b)
    return out
  }, [visible, stageOf])

  const moveCard = useCallback(
    (batch: ClientBatch, dir: 1 | -1) => {
      const cur = stageOf(batch)
      const target = adjacentBatchStage(cur, dir)
      if (!target) return
      setOverrides((o) => ({ ...o, [batch.clientId]: target }))
      startMove(async () => {
        const res = await moveBatch(batch.ideas.map((i) => i.id), target)
        if (res?.error) {
          setOverrides((o) => ({ ...o, [batch.clientId]: cur }))
          toast({ title: 'No se pudo mover el batch', description: res.error, variant: 'destructive' })
        }
      })
    },
    [stageOf, toast],
  )

  const published = visible.filter((b) => stageOf(b) === 'publication').length

  // ── Click-and-drag horizontal panning of the columns (grab/grabbing cursor) ──
  const scrollRef = useRef<HTMLDivElement>(null)
  const pan = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 })
  const [grabbing, setGrabbing] = useState(false)

  const onPanDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // left button only
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
    // The click that follows an on-element drag is swallowed by onClickCapture
    // (which clears `moved`). But a drag that ends OFF the element fires no click,
    // so clear `moved` next frame to avoid stranding it and swallowing a later,
    // unrelated click (e.g. a keyboard-activated button has no preceding mousedown).
    if (pan.current.moved && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => { pan.current.moved = false })
    }
  }, [])
  // Swallow the click that follows a real drag so a card doesn't open mid-pan.
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
            <p className="text-[11px] text-muted-foreground">Nate Media · batches por cliente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar clientes, personas…" className="h-8 w-52 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none" />
          </div>
          <ClientFilterDropdown clients={clients} counts={clientCounts} total={batches.length} value={clientFilter} onChange={setClientFilter} />
          <HeaderButton icon={Filter} label="Filtros" />
          <HeaderButton icon={LayoutGrid} label="Agrupar" trailing={ChevronDown} />
          <NewVideoDialog
            clients={allClients.length > 0 ? allClients : clients}
            pipelineByClient={pipelineByClient}
            clientCadence={clientCadence}
          />
        </div>
      </header>

      {/* Assignee filter — any active team member · batch stats on the right */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80"><Users className="h-3.5 w-3.5" /> Asignado a</span>
        <AssigneeFilterDropdown
          members={team}
          counts={assigneeCounts}
          total={batches.length}
          value={assigneeFilter}
          onChange={setAssigneeFilter}
        />
        <p className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          <span className="text-foreground">{visible.length}</span> batches · <span className="text-emerald-400">{published}</span> publicados
        </p>
      </div>

      {/* Columns — drag anywhere on the board to pan horizontally (grab cursor) */}
      <div
        ref={scrollRef}
        data-testid="pipeline-scroll"
        onMouseDown={onPanDown}
        onMouseMove={onPanMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
        onClickCapture={onPanClickCapture}
        className={cn('flex-1 overflow-x-auto overflow-y-hidden', grabbing ? 'cursor-grabbing select-none' : 'cursor-grab')}
      >
        <div className="flex h-full min-w-max gap-3 p-4">
          {BATCH_STAGES.map((stage) => (
            <BatchColumn key={stage.key} stageKey={stage.key} label={stage.label} batches={byStage[stage.key]} planned={stage.key === 'idea' ? visiblePlanned : undefined} onMove={moveCard} onOpen={openClientBatch} />
          ))}
        </div>
      </div>

      {/* In-place full-screen overlay: the client's "Lote de videos" (Pencil) */}
      {openClientId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          {!batchData ? (
            <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <button
                onClick={closeBatch}
                aria-label="Cerrar"
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              {batchLoading ? 'Cargando…' : 'No se pudo cargar el cliente.'}
            </div>
          ) : (
            <ClientBatchView
              pipeline={batchData.pipeline}
              plannedSlots={batchData.plannedSlots}
              config={batchData.config}
              members={batchData.members}
              singleVideoMode={openOptions?.fromPlanned}
              plannedPublishLabel={openOptions?.publishLabel ?? undefined}
              onClose={closeBatch}
              onChanged={refetchBatch}
            />
          )}
        </div>
      )}
    </div>
  )
}

function BatchColumn({ stageKey, label, batches, planned, onMove, onOpen }: { stageKey: BatchStageKey; label: string; batches: ClientBatch[]; planned?: PlannedClient[]; onMove: (b: ClientBatch, dir: 1 | -1) => void; onOpen: (clientId: string, opts?: ClientBatchOpenOptions) => void }) {
  const plannedCards = (planned ?? []).flatMap((p) => p.sessions.map((s) => ({ client: p, session: s })))
  const count = batches.length + plannedCards.length
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
              <PlannedSessionCard key={`${client.clientId}-${session.index}`} client={client} session={session} onOpen={onOpen} />
            ))}
            {batches.map((b) => <BatchCard key={b.clientId} batch={b} stage={stageKey} onMove={onMove} onOpen={onOpen} />)}
          </>
        )}
      </div>
    </section>
  )
}

/** Visual-only card: the client's next planned video (one slot, not a full session batch). */
function PlannedSessionCard({
  client,
  session,
  onOpen,
}: {
  client: PlannedClient
  session: PlannedSession
  onOpen: (clientId: string, opts?: ClientBatchOpenOptions) => void
}) {
  const isSingle = session.total <= 1
  const daysSinceStart = client.createdAt ? calendarDaysSince(client.createdAt) : null
  const daysInRow = client.inColumnSince ? calendarDaysSince(client.inColumnSince) : daysSinceStart
  const timingLabel =
    daysSinceStart !== null
      ? `${formatDaysElapsedEs(daysSinceStart)} desde inicio · ${formatDaysElapsedEs(daysInRow ?? 0)} en esta fila`
      : session.empty > 0
        ? (isSingle ? 'Por idear' : `${session.empty} por idear`)
        : 'Lleno'
  return (
    <article
      onClick={() =>
        onOpen(client.clientId, {
          fromPlanned: true,
          publishDate: session.publishDate ?? null,
          publishLabel: session.publishDate ? session.label : null,
        })
      }
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-dashed border-sky-500/25 bg-gradient-to-b from-sky-500/[0.07] via-card to-card shadow-sm transition-all hover:border-sky-500/40 hover:from-sky-500/[0.11] hover:shadow-md"
    >
      <div className="space-y-2.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Planificado
          </span>
          {session.publishDate && isSingle && (
            <span className="truncate text-[10px] font-medium text-sky-600/90 dark:text-sky-400/90">
              {session.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <ClientLogo name={client.clientName} logoUrl={client.logoUrl} className="h-8 w-8 text-[10px] ring-1 ring-border/60" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{client.clientName}</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {isSingle
                ? (session.publishDate ? 'Próxima publicación' : '1 video por idear')
                : `${session.label} · ${session.total} video${session.total === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        {isSingle ? (
          <PipelineVideoThumb name={client.clientName} logoUrl={client.logoUrl} />
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: Math.min(session.total, 24) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-6 rounded-[5px] border',
                  i < session.filled ? 'border-transparent bg-cyan-500/30' : 'border-dashed border-border bg-muted/40',
                )}
              />
            ))}
          </div>
        )}

        {(client.nextStage || client.stepAssignee) && (
          <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1.5">
            {client.stepAssignee ? (
              <>
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-500/15 text-[9px] font-bold text-sky-700 dark:text-sky-300"
                  aria-hidden
                >
                  {client.stepAssignee.name.slice(0, 1).toUpperCase()}
                </span>
                <p className="min-w-0 truncate text-[10px] text-muted-foreground">
                  Le toca a <span className="font-semibold text-foreground">{client.stepAssignee.name}</span>
                  {client.nextStage ? ` · ${STAGE_LABEL_ES[client.nextStage]}` : ''}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Sin responsable
                {client.nextStage ? ` · ${STAGE_LABEL_ES[client.nextStage]}` : ''}
                <span className="text-muted-foreground/70"> — asígnalo en Configuración</span>
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5">
            {client.platforms && client.platforms.length > 0 && <PlatformBadges platforms={client.platforms.slice(0, 4)} />}
          </div>
          <span
            className="text-[10px] text-muted-foreground"
            title={
              client.createdAt
                ? `Cliente desde ${client.createdAt.slice(0, 10)}${client.inColumnSince ? ` · En esta fila desde ${client.inColumnSince.slice(0, 10)}` : ''}`
                : undefined
            }
          >
            {timingLabel}
          </span>
        </div>
      </div>
    </article>
  )
}

/** Video-frame strip: real thumb when available, otherwise the client logo / initials. */
function PipelineVideoThumb({
  name,
  logoUrl,
  thumbUrl,
}: {
  name: string
  logoUrl?: string | null
  thumbUrl?: string | null
}) {
  const src = thumbUrl ?? logoUrl
  if (src) {
    return (
      <div className="relative h-[42px] overflow-hidden rounded-lg border border-border/60 bg-muted/30 ring-1 ring-inset ring-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
      </div>
    )
  }
  return (
    <div className="grid h-[42px] place-items-center rounded-lg border border-dashed border-border/70 bg-muted/30 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      {name.slice(0, 2)}
    </div>
  )
}

const BatchCard = memo(function BatchCard({ batch, stage, onMove, onOpen }: { batch: ClientBatch; stage: BatchStageKey; onMove: (b: ClientBatch, dir: 1 | -1) => void; onOpen: (clientId: string) => void }) {
  const a = userAccent(batch.assignee?.id)
  const canBack = adjacentBatchStage(stage, -1) !== null
  const canFwd = adjacentBatchStage(stage, 1) !== null
  const pct = Math.round(batchProgress(stage) * 100)
  const thumbs = Math.min(3, batch.total)
  const more = batch.total - thumbs

  // Worst deadline across the batch's videos → one Atrasado/Pronto badge so leads
  // can triage urgency from the board without opening each client.
  const dlt = deadlineTone(worstDeadlineStatus(batch.ideas))

  return (
    <article onClick={() => onOpen(batch.clientId)} className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-foreground/20 hover:bg-muted" style={{ boxShadow: 'inset 3px 0 0 0 ' + a.dot }}>
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <MoveBtn dir={-1} disabled={!canBack} onClick={(e) => { e.stopPropagation(); onMove(batch, -1) }} />
        <MoveBtn dir={1} disabled={!canFwd} onClick={(e) => { e.stopPropagation(); onMove(batch, 1) }} />
      </div>

      <div className="space-y-2.5 p-3 pl-3.5">
        {/* client + period */}
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[12px] font-bold text-black" style={{ backgroundColor: a.dot }}>{batch.clientName.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{batch.clientName}</p>
              {dlt.label && (
                <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none whitespace-nowrap', dlt.className)}>
                  <Flag className="h-2.5 w-2.5" aria-hidden />
                  {dlt.label}
                </span>
              )}
            </div>
            <p className="truncate text-[10px] text-muted-foreground">{batch.total} video{batch.total === 1 ? '' : 's'} en el batch</p>
          </div>
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        </div>

        {/* thumbnail strip (assignee-tinted) */}
        <div className="flex gap-1">
          {Array.from({ length: thumbs }).map((_, i) => (
            <div key={i} className="h-[42px] flex-1 rounded-md" style={{ background: `linear-gradient(135deg, ${a.dot}, ${a.dot}22 70%, transparent)` }} />
          ))}
          {more > 0 && <div className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">+{more}</div>}
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

        {/* footer: platforms + assignee (colored) */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5">
            {batch.platforms.length > 0 && <PlatformBadges platforms={batch.platforms.slice(0, 4) as SocialPlatform[]} />}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">{batch.assignee?.name ?? 'Sin asignar'}</span>
            <span className="grid h-[18px] w-[18px] place-items-center rounded-full text-[9px] font-bold text-black" style={{ backgroundColor: a.dot }}>{(batch.assignee?.name ?? '?').slice(0, 1).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </article>
  )
})

function MoveBtn({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: (e: React.MouseEvent) => void }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft
  return (
    <button onClick={onClick} disabled={disabled} aria-label={dir === 1 ? 'Mover batch adelante' : 'Mover batch atrás'} className="grid h-5 w-5 place-items-center rounded border border-border bg-background/80 text-muted-foreground backdrop-blur-sm transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

/** Searchable assignee picker — lists every active team member, not only batch owners. */
function AssigneeFilterDropdown({
  members,
  counts,
  total,
  value,
  onChange,
}: {
  members: { id: string; name: string }[]
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

  const selected =
    value === 'unassigned'
      ? { id: 'unassigned', name: 'Sin asignar' }
      : value
        ? members.find((m) => m.id === value) ?? null
        : null
  const label = selected ? selected.name : 'Todos'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members
  }, [members, query])

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
          'inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-md border px-2.5 text-xs transition',
          value
            ? 'border-primary/40 bg-primary/10 text-foreground'
            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {selected && selected.id !== 'unassigned' ? (
          <span
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold text-black"
            style={{ backgroundColor: userAccent(selected.id).dot }}
          >
            {selected.name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <Users className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{label}</span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 opacity-60 transition', open && 'rotate-180')} />
      </button>

      {value && (
        <button
          type="button"
          aria-label="Quitar filtro de persona"
          onClick={() => choose(null)}
          className="ml-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar persona…"
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
                  Todos
                </span>
                <span className="shrink-0 tabular-nums opacity-60">{total}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === 'unassigned'}
                onClick={() => choose('unassigned')}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition',
                  value === 'unassigned' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2">
                  {value === 'unassigned' ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />}
                  Sin asignar
                </span>
                <span className="shrink-0 tabular-nums opacity-60">{counts.unassigned ?? 0}</span>
              </button>
            </li>
            {filtered.map((m) => {
              const on = value === m.id
              const a = userAccent(m.id)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => choose(m.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition',
                      on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {on ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : (
                        <span
                          className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8px] font-bold text-black"
                          style={{ backgroundColor: a.dot }}
                        >
                          {m.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate">{m.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums opacity-60">{counts[m.id] ?? 0}</span>
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
