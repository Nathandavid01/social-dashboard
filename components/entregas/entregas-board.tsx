'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Search, Filter, LayoutGrid, Plus, ChevronDown, ChevronLeft, ChevronRight, GripVertical, Users, X, Building2, Check, Flag, RotateCcw, CalendarClock, CheckCircle2, ExternalLink } from 'lucide-react'
import { cn, calendarDaysSince, formatDaysElapsedEs } from '@/lib/utils'
import { panScrollLeft, isPanDrag } from '@/lib/utils/drag-scroll'
import { worstDeadlineStatus, deadlineTone } from '@/lib/utils/deadlines'
import { ENTREGA_BATCH_STAGES, groupIntoBatches, bucketBatches, adjacentBatchStage, batchProgress, buildClientPipelineIndex, emptyStageBuckets, splitBatchesByStage, ENTREGA_LABEL_ES, entregaCardKey, type EntregaStageKey, type EntregaBatch, type ClientCadence } from '@/lib/entregas/batches'
import { userAccent } from '@/lib/utils/user-accent'
import { useToast } from '@/lib/hooks/use-toast'
import { ClientLogo } from '@/components/clients/client-logo'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { ReviewOverlay } from './review-overlay'
import { CopyOverlay } from './copy-overlay'
import { PublishScheduleCard } from './publish-schedule-card'
import { DiscardCardButton } from './discard-card-button'
import { DIAS, diaDeTablero, offsetSemanaTablero, rangoSemana, type DiaKey, type ModoDia } from '@/lib/entregas/dias'

/** '3 – 8 ago' — con "Esta semana" a secas no se sabe de qué fechas se habla. */
function etiquetaRango(semana: number): string {
  const { desde, hasta } = rangoSemana(undefined, semana)
  const f = (iso: string, conMes: boolean) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d, 12).toLocaleDateString('es', conMes ? { day: 'numeric', month: 'short' } : { day: 'numeric' })
  }
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7)
  return `${f(desde, !mismoMes)} – ${f(hasta, true)}`
}
import { semanaDeEntregas } from '@/lib/entregas/semana'
import { WeekView } from './week-view'
import { EditorSubmitSlot } from '@/components/pipeline/editor-submit-slot'
import type { PlannedSession } from '@/lib/utils/planned-sessions'
import type { IdeaWithPipeline, SocialPlatform } from '@/lib/supabase/types'
import type { ReviewNote } from '@/lib/actions/review-notes-core'
import { EnlaceClienteBoton } from './enlace-cliente-boton'
import { marcaAprobacionCliente, type EstadoCliente } from '@/lib/entregas/marca-cliente'

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
  /** Pipeline column this planned slot is waiting in (always video for now). */
  nextStage?: EntregaStageKey
  /** Team member configured in settings for `nextStage`. */
  stepAssignee?: { id: string; name: string } | null
  sessions: PlannedSession[]
}

const STAGE_DOT: Record<EntregaStageKey, string> = {
  edited: '#8b5cf6', approval: '#f59e0b', copy: '#ec4899', publication: '#10b981',
}

/** Global content pipeline — one card per CLIENT BATCH, colored by its assignee. */
export function EntregasBoard({
  ideas,
  plannedClients = [],
  allClients = [],
  clientCadence = {},
  teamMembers = [],
  submitClients,
  stages,
  postingTimes = {},
  reviewNotes = {},
  clientApprovals = {},
  postedLinks = {},
  modoDia = 'entrega',
}: {
  ideas: Idea[]
  plannedClients?: PlannedClient[]
  /** Every active client — used by "Nuevo video" so you can pick any account. */
  allClients?: { id: string; name: string }[]
  clientCadence?: Record<string, ClientCadence>
  /** All active team members — powers the "Asignado a" filter (not just people on batches). */
  teamMembers?: { id: string; name: string }[]
  /** Clientes que esta persona puede entregar. El tablero monta el formulario
   *  él mismo porque necesita el día de la pestaña activa, y una función no
   *  puede cruzar de un Server Component a uno de cliente. */
  submitClients?: { id: string; name: string }[]
  /** Columnas de esta pantalla. El flujo vive en dos rutas: /revision lleva
   *  entrega y revisión, /entregas copy y publicación. La ruta manda; el rol
   *  decide a cuál puede entrar. */
  stages: EntregaStageKey[]
  /** clients.posting_time — the hour Metricool will schedule at, per client. */
  postingTimes?: Record<string, string | null>
  /** Lo que el revisor pidió cambiar, por id de video. La etiqueta "Cambios
   *  pedidos" ya existía, pero sin el texto el editor no sabía qué corregir. */
  reviewNotes?: Record<string, ReviewNote>
  /** Lo que el cliente respondió por video, para marcarlo en la tarjeta. */
  clientApprovals?: Record<string, EstadoCliente>
  /** idea id → URL pública que Metricool recibió (log posted_to_metricool).
   *  Alimenta el enlace "Ver post enviado" de la tarjeta ya programada. */
  postedLinks?: Record<string, string>
  /** Desde qué lado se mira la fecha. Revisión razona en día de entrega; Copy y
   *  Publicación en día de publicación, que es la cadencia del cliente. */
  modoDia?: ModoDia
}) {
  // Las columnas dependen del rol: enseñar una en la que no puedes actuar solo
  // llena el tablero de trabajo ajeno. Los permisos de cada acción siguen
  // mandando en el servidor; esto es la vista.
  // La ruta define las columnas; el rol solo decide si puede abrirla.
  const visibleStages = stages

  // La operación es POR DÍA: cada día tiene su tablero completo. Sin esto,
  // el lunes y el jueves se mezclan en las mismas columnas y nadie sabe qué
  // toca hoy.
  const [dia, setDia] = useState<DiaKey | 'sin'>(DIAS[0].key)
  // Las pestañas contestan "qué hago hoy"; la semana, "cómo viene". Empieza en
  // día: es lo que se abre para trabajar.
  const [vista, setVista] = useState<'dia' | 'semana'>('dia')
  // Cuánto adelantado se trabaja: 0 lo próximo, 1 la semana siguiente. Manda a
  // la vez sobre lo que se ve y sobre para cuándo se entrega, para que no
  // puedan contradecirse.
  const [semanaOffset, setSemanaOffset] = useState(0)
  // Sin useMemo con new Date(): se calcula una vez al montar. El domingo no
  // resalta ninguna columna, que es correcto — nadie entrega en domingo.
  const [hoyDia] = useState<DiaKey | null>(() => {
    const d = new Date().getDay()
    return d >= 1 && d <= 6 ? (d as DiaKey) : null
  })

  const [clientFilter, setClientFilter] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [overrides, setOverrides] = useState<Record<string, EntregaStageKey>>({})
  const [, startMove] = useTransition()
  const { toast } = useToast()

  // Overlay a pantalla completa, sin navegar fuera del tablero.
  // Qué se abre depende de la COLUMNA: una tarjeta en Revisión pide decidir,
  // una en Copy pide escribir. Abrir siempre lo mismo mandaba a Revisión desde
  // Copy, con un "no queda nada por revisar" que no explicaba nada.
  // Con ideaId: la tarjeta es UN video, así que abrirla tiene que enseñar ese
  // y no todos los del cliente. Ver los cinco de un cliente al abrir uno
  // obligaba a buscar cuál era, que es justo lo que la tarjeta ya resolvía.
  const [open, setOpen] = useState<{ clientId: string; stage: EntregaStageKey; ideaId: string } | null>(null)
  const openClientId = open?.clientId ?? null

  const openEntregaBatch = useCallback((clientId: string, stage: EntregaStageKey, ideaId: string) => {
    setOpen({ clientId, stage, ideaId })
  }, [])
  const closeBatch = useCallback(() => setOpen(null), [])

  // One card per (client, stage): a client with videos in two columns shows in
  // both, instead of parking in the least-advanced one.
  const ideasDelDia = useMemo(
    () => ideas.filter((i) => {
      const d = diaDeTablero(i.publish_date as string | null, modoDia)
      if (dia === 'sin') return d === null
      if (d !== dia) return false
      // Lo atrasado se queda en la semana 0: es trabajo que sigue pendiente y
      // esconderlo por estar vencido es justo lo contrario de lo que hace falta.
      const w = offsetSemanaTablero(i.publish_date as string | null, modoDia)
      return semanaOffset === 0 ? (w ?? 0) <= 0 : w === semanaOffset
    }),
    [ideas, dia, semanaOffset, modoDia],
  )

  /** Cuántos videos hay en cada día, para que la pestaña lo diga sin entrar. */
  const conteoPorDia = useMemo(() => {
    const m: Record<string, number> = { sin: 0 }
    for (const i of ideas) {
      // Los descartados no cuentan: groupIntoBatches ya los excluye de las
      // tarjetas, asi que sin esto la pestaña anunciaba un numero de videos que
      // no estaban en ninguna parte al entrar.
      if (i.status === 'descartada') continue
      const d = diaDeTablero(i.publish_date as string | null, modoDia)
      if (d !== null) {
        const w = offsetSemanaTablero(i.publish_date as string | null, modoDia)
        const enEstaSemana = semanaOffset === 0 ? (w ?? 0) <= 0 : w === semanaOffset
        if (!enEstaSemana) continue
      }
      const k = d === null ? 'sin' : String(d)
      m[k] = (m[k] ?? 0) + 1
    }
    return m
  }, [ideas, semanaOffset, modoDia])

  const semana = useMemo(() => semanaDeEntregas(ideas as unknown as Parameters<typeof semanaDeEntregas>[0], undefined, semanaOffset, modoDia), [ideas, semanaOffset, modoDia])

  const batches = useMemo(() => splitBatchesByStage(groupIntoBatches(ideasDelDia)), [ideasDelDia])

  const cardKey = useCallback((b: EntregaBatch) => entregaCardKey(b), [])

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
    for (const b of batches) m[b.clientId] = (m[b.clientId] ?? 0) + b.total
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

  const stageOf = useCallback((b: EntregaBatch) => overrides[cardKey(b)] ?? b.stage, [overrides, cardKey])

  const byStage = useMemo(() => {
    const out = emptyStageBuckets<EntregaBatch>()
    for (const b of visible) out[stageOf(b)].push(b)
    return out
  }, [visible, stageOf])

  // En Entregas una tarjeta avanza por una DECISIÓN (enviar a revisión,
  // aprobar, escribir el copy), no arrastrándola. Sin mover manual, la columna
  // siempre refleja el estado real del video.
  const moveCard = useCallback((_b: EntregaBatch, _d: 1 | -1) => {}, [])

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
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">Pipeline de contenido</h1>
            <p className="text-[11px] text-muted-foreground">Nate Media · lotes por cliente</p>
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
      {/* La operación es por día: cada pestaña es su propio tablero. */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 pb-2">
        {DIAS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDia(d.key)}
            aria-pressed={dia === d.key}
            aria-label={d.label}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition',
              dia === d.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {d.label}
            {(conteoPorDia[String(d.key)] ?? 0) > 0 && (
              <span className={cn(
                'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                dia === d.key ? 'bg-black/20' : 'bg-muted',
              )}>
                {conteoPorDia[String(d.key)]}
              </span>
            )}
          </button>
        ))}
        {/* Un video sin fecha no desaparece del tablero: se ve aquí y se puede
            arreglar, en vez de existir en la base y en ninguna pestaña. */}
        {(conteoPorDia.sin ?? 0) > 0 && (
          <button
            onClick={() => setDia('sin')}
            aria-pressed={dia === 'sin'}
            aria-label="Sin día"
            className={cn(
              'ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition',
              dia === 'sin'
                ? 'bg-amber-500 text-black'
                : 'text-amber-600 hover:bg-amber-500/10 dark:text-amber-400',
            )}
          >
            Sin día
            <span className="rounded-full bg-black/20 px-1.5 text-[10px] font-semibold tabular-nums">
              {conteoPorDia.sin}
            </span>
          </button>
        )}

        {/* Para el editor que va adelantado. Las pestañas solo distinguen el
            día, así que sin esto dos martes distintos caían en la misma,
            mezclados y sin forma de saber cuál era de cuándo. */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border p-0.5">
          <button
            onClick={() => setSemanaOffset((w) => Math.max(0, w - 1))}
            disabled={semanaOffset === 0}
            aria-label="Semana anterior"
            className="rounded-md px-1.5 py-1 text-muted-foreground transition hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="flex flex-col items-center whitespace-nowrap px-1.5 leading-tight">
            <span className="text-[11px] font-medium">
              {semanaOffset === 0 ? 'Esta semana' : semanaOffset === 1 ? 'Próxima semana' : `En ${semanaOffset} semanas`}
            </span>
            <span className="text-[9.5px] tabular-nums text-muted-foreground">{etiquetaRango(semanaOffset)}</span>
          </span>
          <button
            onClick={() => setSemanaOffset((w) => w + 1)}
            aria-label="Semana siguiente"
            className="rounded-md px-1.5 py-1 text-muted-foreground transition hover:bg-muted"
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Día para trabajar, semana para planificar. El conmutador va aquí y
            no en otra ruta: es la misma información mirada de otra manera. */}
        <div className={cn('flex shrink-0 gap-0.5 rounded-lg border p-0.5', (conteoPorDia.sin ?? 0) > 0 ? '' : 'ml-auto')}>
          {(['dia', 'semana'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              aria-pressed={vista === v}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                vista === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {v === 'dia' ? 'Día' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {vista === 'semana' && (
        <div className="border-b px-4 pb-3">
          <WeekView
            semana={semana}
            hoy={hoyDia}
            onAbrirDia={(d) => { setDia(d); setVista('dia') }}
            modoDia={modoDia}
          />
        </div>
      )}

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
          {ENTREGA_BATCH_STAGES.filter((s) => visibleStages.includes(s.key)).map((stage) => (
            <BatchColumn key={stage.key} stageKey={stage.key} label={ENTREGA_LABEL_ES[stage.key]} batches={byStage[stage.key]} planned={stage.key === 'edited' ? visiblePlanned : undefined} topSlot={stage.key === 'edited' && dia !== 'sin' && submitClients ? <EditorSubmitSlot clients={submitClients} dia={dia} semanaOffset={semanaOffset} /> : undefined} postingTimes={postingTimes} onMove={moveCard} onOpen={openEntregaBatch} reviewNotes={reviewNotes} clientApprovals={clientApprovals} postedLinks={postedLinks} />
          ))}
        </div>
      </div>

      {/* Abrir una tarjeta de Revisión abre la COLA de revisión — reproductor y
          decisión — no la vista de lote del otro tablero, que contesta otra
          pregunta (el periodo del cliente, no "¿este video está bien?"). */}
      {open && open.stage === 'approval' && (
        <ReviewOverlay
          clientId={open.clientId}
          ideaId={open.ideaId}
          clientName={batches.find((b) => b.clientId === open.clientId)?.clientName ?? 'Cliente'}
          onClose={closeBatch}
        />
      )}
      {open && open.stage === 'copy' && (
        <CopyOverlay
          clientId={open.clientId}
          ideaId={open.ideaId}
          clientName={batches.find((b) => b.clientId === open.clientId)?.clientName ?? 'Cliente'}
          onClose={closeBatch}
        />
      )}
    </div>
  )
}

function BatchColumn({ stageKey, label, batches, planned, topSlot, postingTimes = {}, onMove, onOpen, reviewNotes = {}, clientApprovals = {}, postedLinks = {} }: { stageKey: EntregaStageKey; label: string; batches: EntregaBatch[]; planned?: PlannedClient[]; topSlot?: React.ReactNode; postingTimes?: Record<string, string | null>; onMove: (b: EntregaBatch, dir: 1 | -1) => void; onOpen: (clientId: string, stage: EntregaStageKey, ideaId: string) => void; reviewNotes?: Record<string, ReviewNote>; clientApprovals?: Record<string, EstadoCliente>; postedLinks?: Record<string, string> }) {
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
        {/* The column lives inside the drag-to-pan surface — swallow mousedown so
            typing/selecting in the submit form doesn't start a horizontal pan. */}
        {topSlot && <div onMouseDown={(e) => e.stopPropagation()}>{topSlot}</div>}
        {count === 0 ? (
          !topSlot && <p className="select-none py-6 text-center text-[11px] text-muted-foreground/40">—</p>
        ) : (
          <>
            {plannedCards.map(({ client, session }) => (
              <PlannedSessionCard key={`${client.clientId}-${session.index}`} client={client} session={session} onOpen={onOpen} />
            ))}
            {batches.map((b) => <BatchCard key={entregaCardKey(b)} batch={b} stage={stageKey} postingTime={postingTimes[b.clientId] ?? null} onMove={onMove} onOpen={onOpen} reviewNotes={reviewNotes} clientApprovals={clientApprovals} postedLinks={postedLinks} />)}
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
  onOpen: (clientId: string, stage: EntregaStageKey, ideaId: string) => void
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
      // Sin video todavia: es un hueco planificado. Abre la columna Editado,
      // que no tiene overlay, asi que el id vacio no llega a usarse.
      onClick={() => onOpen(client.clientId, 'edited', '')}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-dashed border-sky-500/25 bg-gradient-to-b from-sky-500/[0.07] via-card to-card shadow-sm transition-all hover:border-sky-500/40 hover:from-sky-500/[0.11] hover:shadow-md [content-visibility:auto] [contain-intrinsic-size:0_220px]"
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
                  {client.nextStage ? ` · ${ENTREGA_LABEL_ES[client.nextStage]}` : ''}
                </p>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Sin responsable
                {client.nextStage ? ` · ${ENTREGA_LABEL_ES[client.nextStage]}` : ''}
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
        <img src={src} alt="" referrerPolicy="no-referrer" width={42} height={42} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
      </div>
    )
  }
  return (
    <div className="grid h-[42px] place-items-center rounded-lg border border-dashed border-border/70 bg-muted/30 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      {name.slice(0, 2)}
    </div>
  )
}

const BatchCard = memo(function BatchCard({ batch, stage, postingTime = null, onMove, onOpen, reviewNotes = {}, clientApprovals = {}, postedLinks = {} }: { batch: EntregaBatch; stage: EntregaStageKey; postingTime?: string | null; onMove: (b: EntregaBatch, dir: 1 | -1) => void; onOpen: (clientId: string, stage: EntregaStageKey, ideaId: string) => void; reviewNotes?: Record<string, ReviewNote>; clientApprovals?: Record<string, EstadoCliente>; postedLinks?: Record<string, string> }) {
  const a = userAccent(batch.assignee?.id)
  const pct = Math.round(batchProgress(stage) * 100)
  const thumbs = Math.min(3, batch.total)
  const more = batch.total - thumbs

  // Worst deadline across the batch's videos → one Atrasado/Pronto badge so leads
  // can triage urgency from the board without opening each client.
  const dlt = deadlineTone(worstDeadlineStatus(batch.ideas))

  // La corrección más reciente del batch. Un batch puede traer varios videos
  // devueltos; se enseña la última, y el detalle por video vive en el overlay.
  // Solo los videos de ESTA tarjeta que tienen respuesta del cliente.
  const marca = marcaAprobacionCliente(
    batch.ideas.map((i) => clientApprovals[i.id]).filter(Boolean) as EstadoCliente[],
    stage,
  )

  const devuelto = batch.ideas
    .map((i) => reviewNotes[i.id])
    .filter(Boolean)
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0]

  // Solo lo realmente enviado (metricool_post_id) enseña su enlace de auditoría.
  const enviado = batch.ideas[0]
  const postedLink = enviado?.metricool_post_id != null ? postedLinks[enviado.id] : undefined

  return (
    <article onClick={() => onOpen(batch.clientId, stage, batch.ideas[0].id)} className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-foreground/20 hover:bg-muted [content-visibility:auto] [contain-intrinsic-size:0_260px]" style={{ boxShadow: 'inset 3px 0 0 0 ' + a.dot }}>
      <div className="absolute right-1.5 top-1.5 z-10 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <DiscardCardButton ideaIds={batch.ideas.map((i) => i.id)} clientName={batch.clientName} />
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
              {/* Work the reviewer handed back. Without this the editor has no
                  signal that anything returned to their column. */}
              {batch.revisionNeeded > 0 && (
                <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-rose-600 dark:text-rose-400">
                  <RotateCcw className="h-2.5 w-2.5" aria-hidden />
                  {batch.revisionNeeded === 1 ? 'Cambios pedidos' : `${batch.revisionNeeded} con cambios`}
                </span>
              )}
            </div>
            {/* Una tarjeta es UN video: lo que identifica la tarjeta es su
                título, no cuántos hay. */}
            <p className="truncate text-[10px] text-muted-foreground">
              {batch.ideas[0]?.title?.trim() || batch.ideas[0]?.hook?.trim() || 'Sin título'}
            </p>
          </div>
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
        </div>


        {/* Lo que hay que corregir. La etiqueta "Cambios pedidos" ya estaba,
            pero sin el texto el editor reenviaba el mismo video sin saber qué
            cambiar. Solo la última ronda: es la que manda. */}
        {devuelto && (
          <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-2">
            <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
              <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
              Cambios pedidos{devuelto.author ? ` · ${devuelto.author}` : ''}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-snug text-foreground/90">
              {devuelto.note}
            </p>
          </div>
        )}

        {/* El cliente puede aprobar antes de que exista el copy. La tarjeta se
            queda en Copy —ideaStage exige el caption para pasar— pero sin esto
            no lo decía en ninguna parte. */}
        {marca && (
          <p
            className={cn(
              'flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold',
              marca.tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
              marca.tone === 'parcial' && 'border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400',
              marca.tone === 'cambios' && 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400',
            )}
          >
            {marca.tone === 'cambios'
              ? <RotateCcw className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              : <CheckCircle2 className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />}
            <span className="truncate">{marca.label}</span>
          </p>
        )}

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

        {/* El enlace de aprobación, en la tarjeta y no dentro de Copy: es un
            clic desde el tablero, que es cuando de verdad se manda al cliente.
            Solo donde la pieza ya está lista para enseñarla. */}
        {(stage === 'copy' || stage === 'publication') && (
          <EnlaceClienteBoton
            clientId={batch.clientId}
            clientName={batch.clientName}
            ideaId={batch.ideas[0].id}
          />
        )}

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

        {/* Publicación es la única columna con una acción externa: mandar el
            video a Metricool. Va en la tarjeta porque no hace falta abrir nada
            para decidirlo — el copy ya está escrito y aprobado. */}
        {/* La fecha que Metricool va a RECIBIR, no la planificada:
            buildPublishDateTime corre a +24h una fecha pasada o ausente para que
            aprobar algo atrasado no publique al instante. La tarjeta además deja
            elegir la hora a mano — un turno de hoy que ya pasó es un 400 seguro. */}
        {stage === 'publication' && (
          <PublishScheduleCard
            ideaIds={batch.ideas.map((i) => i.id)}
            publishDate={batch.ideas[0]?.publish_date ?? null}
            postingTime={postingTime}
          />
        )}

        {/* Lo ya enviado se puede VERIFICAR desde la tarjeta: el enlace abre la
            URL pública exacta que Metricool recibió (log posted_to_metricool),
            no el archivo actual de la idea — el punto es auditar el envío.
            Un batch es UN video (groupIntoBatches), así que hay un solo enlace. */}
        {stage === 'publication' && postedLink && (
          <a
            href={postedLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[10px] font-medium text-emerald-600 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 dark:text-emerald-400"
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">Ver post enviado</span>
          </a>
        )}
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
