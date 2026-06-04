'use client'

import { memo, useCallback, useMemo, useState, useTransition } from 'react'
import { Search, Filter, LayoutGrid, Plus, ChevronDown, ChevronLeft, ChevronRight, GripVertical, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BATCH_STAGES, groupIntoBatches, bucketBatches, adjacentBatchStage, batchProgress, type BatchStageKey, type ClientBatch } from '@/lib/utils/content-batches'
import { userAccent } from '@/lib/utils/user-accent'
import { moveBatch } from '@/lib/actions/content-ideas'
import { getClientBatchData, type ClientBatchData } from '@/lib/actions/client-batch'
import { useToast } from '@/lib/hooks/use-toast'
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
  platforms?: SocialPlatform[]
  sessions: PlannedSession[]
}

const STAGE_DOT: Record<BatchStageKey, string> = {
  idea: '#3b82f6', title: '#64748b', caption: '#a855f7', video: '#06b6d4',
  edited: '#8b5cf6', approval: '#f59e0b', publication: '#10b981',
}

/** Global content pipeline — one card per CLIENT BATCH, colored by its assignee. */
export function ContentPipelineBoard({ ideas, plannedClients = [] }: { ideas: Idea[]; plannedClients?: PlannedClient[] }) {
  const [clientFilter, setClientFilter] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [overrides, setOverrides] = useState<Record<string, BatchStageKey>>({})
  const [, startMove] = useTransition()
  const { toast } = useToast()

  // In-place full-screen overlay of a client's batch view (no navigation).
  const [openClientId, setOpenClientId] = useState<string | null>(null)
  const [batchData, setBatchData] = useState<ClientBatchData | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)

  const openClientBatch = useCallback(async (clientId: string) => {
    setOpenClientId(clientId)
    setBatchData(null)
    setBatchLoading(true)
    const data = await getClientBatchData(clientId)
    setBatchData(data)
    setBatchLoading(false)
  }, [])
  const closeBatch = useCallback(() => {
    setOpenClientId(null)
    setBatchData(null)
  }, [])
  const refetchBatch = useCallback(async () => {
    if (!openClientId) return
    const data = await getClientBatchData(openClientId)
    setBatchData(data)
  }, [openClientId])

  const batches = useMemo(() => groupIntoBatches(ideas), [ideas])

  const clients = useMemo(
    () => batches.map((b) => ({ id: b.clientId, name: b.clientName })).sort((a, b) => a.name.localeCompare(b.name)),
    [batches],
  )
  const team = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>()
    for (const b of batches) if (b.assignee) m.set(b.assignee.id, b.assignee)
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [batches])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return batches.filter((b) => {
      if (clientFilter && b.clientId !== clientFilter) return false
      if (assigneeFilter && b.assignee?.id !== assigneeFilter) return false
      if (q && !(`${b.clientName} ${b.assignee?.name ?? ''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [batches, clientFilter, assigneeFilter, search])

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
          <HeaderButton icon={Filter} label="Filtros" />
          <HeaderButton icon={LayoutGrid} label="Agrupar" trailing={ChevronDown} />
          <NewVideoDialog clients={clients} />
        </div>
      </header>

      {/* Client chips + stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={clientFilter === null} onClick={() => setClientFilter(null)} dot="#3b82f6" label="Todos" count={batches.length} />
          {clients.map((c) => (
            <Chip key={c.id} active={clientFilter === c.id} onClick={() => setClientFilter(clientFilter === c.id ? null : c.id)} dot="#9aa0aa" label={c.name} count={batches.filter((b) => b.clientId === c.id).length} />
          ))}
        </div>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          <span className="text-foreground">{visible.length}</span> batches · <span className="text-emerald-400">{published}</span> publicados
        </p>
      </div>

      {/* Assignee filter — color = person */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80"><Users className="h-3.5 w-3.5" /> Asignado a</span>
        <button onClick={() => setAssigneeFilter(null)} className={cn('rounded-full border px-3 py-1 text-[11px] font-medium transition', assigneeFilter === null ? 'border-white/20 bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60')}>Todos</button>
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
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-3 p-4">
          {BATCH_STAGES.map((stage) => (
            <BatchColumn key={stage.key} stageKey={stage.key} label={stage.label} batches={byStage[stage.key]} planned={stage.key === 'idea' ? plannedClients : undefined} onMove={moveCard} onOpen={openClientBatch} />
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
              onClose={closeBatch}
              onChanged={refetchBatch}
            />
          )}
        </div>
      )}
    </div>
  )
}

function BatchColumn({ stageKey, label, batches, planned, onMove, onOpen }: { stageKey: BatchStageKey; label: string; batches: ClientBatch[]; planned?: PlannedClient[]; onMove: (b: ClientBatch, dir: 1 | -1) => void; onOpen: (clientId: string) => void }) {
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

/** Visual-only card: a planned recording session with empty slots waiting for ideas. */
function PlannedSessionCard({ client, session, onOpen }: { client: PlannedClient; session: PlannedSession; onOpen: (clientId: string) => void }) {
  const slots = Math.min(session.total, 24) // cap the drawn boxes; count stays exact
  return (
    <article
      onClick={() => onOpen(client.clientId)}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-dashed border-border bg-card transition-all hover:border-foreground/30 hover:bg-muted"
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

const BatchCard = memo(function BatchCard({ batch, stage, onMove, onOpen }: { batch: ClientBatch; stage: BatchStageKey; onMove: (b: ClientBatch, dir: 1 | -1) => void; onOpen: (clientId: string) => void }) {
  const a = userAccent(batch.assignee?.id)
  const canBack = adjacentBatchStage(stage, -1) !== null
  const canFwd = adjacentBatchStage(stage, 1) !== null
  const pct = Math.round(batchProgress(stage) * 100)
  const thumbs = Math.min(3, batch.total)
  const more = batch.total - thumbs

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
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{batch.clientName}</p>
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

function Chip({ active, onClick, dot, label, count }: { active: boolean; onClick: () => void; dot: string; label: string; count: number }) {
  return (
    <button onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition', active ? 'border-white/20 bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
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
