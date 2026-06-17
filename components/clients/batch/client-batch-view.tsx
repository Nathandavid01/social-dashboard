'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronLeft, ChevronRight, LayoutGrid, Lightbulb, MessageSquare, Plus, Users, X, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { NewVideoDialog } from '@/components/pipeline/new-video-dialog'
import { cn } from '@/lib/utils'
import {
  batchHint,
  buildStepper,
  cardStatus,
  summarizeBatchVideos,
  type BatchVideo,
} from '@/lib/utils/batch-view'
import type { PlannedSlot } from '@/lib/utils/planned-sessions'
import type { ClientVideoPipeline } from '@/lib/actions/video-pipeline'
import type { BatchConfig, TeamMember } from '@/lib/actions/client-batch'
import { BatchSummaryBar } from './batch-summary-bar'
import { BatchStepper } from './batch-stepper'
import { VideoWorkCard } from './video-work-card'

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active: { label: 'Activo', tone: 'bg-emerald-500/10 text-emerald-500' },
  paused: { label: 'Pausado', tone: 'bg-amber-500/10 text-amber-500' },
  inactive: { label: 'Inactivo', tone: 'bg-muted text-muted-foreground' },
  archived: { label: 'Archivado', tone: 'bg-muted text-muted-foreground' },
}

const WEEKDAY_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "Lun 9 jun" from an ISO 'YYYY-MM-DD' (parsed as a local date, no TZ shift). */
function formatSlotDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${WEEKDAY_ES[date.getDay()]} ${d} ${MONTH_ES[m - 1]}`
}

export function ClientBatchView({
  pipeline,
  plannedSlots = [],
  config = { batchLabel: null, videosPerBatch: null },
  members = [],
  onClose,
  onChanged,
}: {
  pipeline: ClientVideoPipeline
  plannedSlots?: PlannedSlot[]
  config?: BatchConfig
  members?: TeamMember[]
  /** When set, the view is an in-place overlay — shows a close button. */
  onClose?: () => void
  /** Called after a create/upload so an overlay can refetch its data. */
  onChanged?: () => void
}) {
  const router = useRouter()
  const { client } = pipeline
  const videos = pipeline.videos as BatchVideo[]
  const clientForDialog = [{ id: client.id, name: client.name }]
  const clientCadence = useMemo(
    () => ({
      postingTime: client.posting_time ?? null,
      postingDays: (client.posting_days ?? []) as number[],
      metricoolBlogId: client.metricool_blog_id ?? null,
    }),
    [client],
  )
  const pipelineByClient = useMemo(() => {
    const summary = summarizeBatchVideos(videos, clientCadence)
    return summary ? { [client.id]: summary } : {}
  }, [videos, client.id, clientCadence])
  const refresh = onChanged ?? (() => router.refresh())

  const stepper = useMemo(() => buildStepper(videos), [videos])
  const hint = useMemo(() => batchHint(videos), [videos])
  const pendientes = useMemo(
    () => videos.filter((v) => cardStatus(v).key === 'por_grabar').length,
    [videos],
  )
  const grabados = videos.length - pendientes

  const [statusFilter, setStatusFilter] = useState<'all' | 'por_grabar' | 'grabado'>('all')
  // Single-video focus: work one video at a time, navigate between them.
  const [sel, setSel] = useState(0)
  const shownVideos = useMemo(
    () => (statusFilter === 'all' ? videos : videos.filter((v) => cardStatus(v).key === statusFilter)),
    [videos, statusFilter],
  )


  const status = STATUS_LABEL[client.status] ?? {
    label: client.status,
    tone: 'bg-muted text-muted-foreground',
  }

  return (
    <div className="flex flex-col">
      {/* topbar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3.5">
        <div className="flex items-center gap-2 text-sm">
          {onClose ? (
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
              Pipeline
            </button>
          ) : (
            <Link
              href="/pipeline"
              className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
              Pipeline
            </Link>
          )}
          <span className="text-muted-foreground/50">/</span>
          <span className="font-semibold text-foreground">{client.name}</span>
        </div>
        {onClose ? (
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={onClose}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Cerrar
          </Button>
        ) : (
          <Button asChild variant="secondary" size="sm" className="gap-1.5">
            <Link href={`/clients/${client.id}`}>
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              Ver perfil
            </Link>
          </Button>
        )}
      </div>

      {/* hero */}
      <div className="flex flex-col gap-4 border-b border-border px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo_url}
              alt={client.name}
              className="h-13 w-13 rounded-xl object-cover"
              style={{ height: 52, width: 52 }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-sm font-bold text-background"
              style={{ height: 52, width: 52 }}
            >
              {client.name.slice(0, 3).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-foreground md:text-2xl">{client.name}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                  status.tone,
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {status.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {client.industry && <span>{client.industry}</span>}
              {client.platforms?.length > 0 && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <PlatformBadges platforms={client.platforms} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* editable batch summary: LOTE / cantidad / ENCARGADO */}
        <BatchSummaryBar
          clientId={client.id}
          videosCount={videos.length}
          config={config}
          members={members}
          assignee={client.assignee}
          onChanged={refresh}
        />
      </div>

      {/* stepper */}
      <div className="border-b border-border px-6 py-5">
        <BatchStepper stages={stepper} />
      </div>

      {/* guidance banner */}
      <div className="px-6 py-3.5">
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.06] px-3.5 py-3">
          <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold text-foreground">
              Este lote está en la etapa {hint.stageLabel}
            </span>
            <span className="text-xs text-muted-foreground">{hint.tip}</span>
          </div>
        </div>
      </div>

      {/* body: editable video cards */}
      <div className="flex flex-col gap-5 px-6 pb-6">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {videos.length === 0 && plannedSlots.length > 0 ? 'Videos por crear' : 'Videos de este lote'}
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {videos.length > 0 ? videos.length : plannedSlots.length}
              </span>
            </div>
            <NewVideoDialog clients={clientForDialog} defaultClientId={client.id} pipelineByClient={pipelineByClient} clientCadence={{ [client.id]: clientCadence }} onCreated={refresh}>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Nuevo video
              </Button>
            </NewVideoDialog>
          </div>

          {videos.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                { key: 'all', label: 'Todos', count: videos.length, dot: '' },
                { key: 'por_grabar', label: 'Por grabar', count: pendientes, dot: 'bg-amber-500' },
                { key: 'grabado', label: 'Grabados', count: grabados, dot: 'bg-emerald-500' },
              ] as const).map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setSel(0) }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                    statusFilter === f.key
                      ? 'border-border bg-muted text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {f.dot && <span className={cn('h-1.5 w-1.5 rounded-full', f.dot)} aria-hidden />}
                  {f.label}
                  <span className="tabular-nums text-muted-foreground/70">{f.count}</span>
                </button>
              ))}
            </div>
          )}

          {videos.length > 0 ? (
            (() => {
              const current = Math.min(sel, Math.max(0, shownVideos.length - 1))
              const v = shownVideos[current]
              const navBtn = 'grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-30'
              return (
                <div className="flex flex-col gap-4">
                  {/* navegador: un video a la vez */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <button type="button" aria-label="Video anterior" disabled={current === 0} onClick={() => setSel(Math.max(0, current - 1))} className={navBtn}>
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </button>
                      <div className="flex flex-wrap items-center gap-1">
                        {shownVideos.map((sv, i) => (
                          <button
                            key={sv.id}
                            type="button"
                            aria-label={`Ir al video ${i + 1}`}
                            aria-current={i === current}
                            onClick={() => setSel(i)}
                            className={cn(
                              'grid h-7 w-7 place-items-center rounded-md border text-xs font-semibold tabular-nums transition',
                              i === current ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <button type="button" aria-label="Video siguiente" disabled={current >= shownVideos.length - 1} onClick={() => setSel(Math.min(shownVideos.length - 1, current + 1))} className={navBtn}>
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Video {current + 1} de {shownVideos.length}
                    </span>
                  </div>
                  {v && (
                    <VideoWorkCard
                      video={v}
                      index={videos.indexOf(v)}
                      platforms={client.platforms}
                      clientName={client.name}
                      clientLogoUrl={client.logo_url}
                    />
                  )}
                </div>
              )
            })()
          ) : plannedSlots.length > 0 ? (
            <>
              <p className="-mt-1 text-xs text-muted-foreground">
                Estos son los {plannedSlots.length} videos del próximo lote. Para cada uno: define la
                idea y el caption, y sube la grabación.
              </p>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {plannedSlots.map((slot) => (
                  <PlannedSlotCard
                    key={slot.index}
                    index={slot.index}
                    dayLabel={formatSlotDay(slot.date)}
                    action={
                      <NewVideoDialog clients={clientForDialog} defaultClientId={client.id} pipelineByClient={pipelineByClient} clientCadence={{ [client.id]: clientCadence }} onCreated={refresh}>
                        <Button variant="secondary" size="sm" className="w-full gap-1.5">
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Crear video
                        </Button>
                      </NewVideoDialog>
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
              </span>
              <p className="text-sm font-medium text-foreground">Este lote aún no tiene videos</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Crea el primer video para empezar a trabajar el contenido de {client.name}.
              </p>
              <NewVideoDialog clients={clientForDialog} defaultClientId={client.id} pipelineByClient={pipelineByClient} clientCadence={{ [client.id]: clientCadence }} onCreated={refresh}>
                <Button size="sm" className="mt-1 gap-1.5">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Nuevo video
                </Button>
              </NewVideoDialog>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** A planned, empty video slot: dated by cadence, waiting for its idea + caption. */
function PlannedSlotCard({ index, dayLabel, action }: { index: number; dayLabel: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-dashed border-border bg-card">
      <div className="flex items-center justify-between border-b border-dashed border-border bg-muted/40 px-3 py-2">
        <span className="text-sm font-semibold text-foreground">Video {index + 1}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Calendar className="h-3 w-3" aria-hidden />
          {dayLabel}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex items-start gap-2">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Idea</p>
            <p className="text-xs text-muted-foreground/70">Por crear</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Caption</p>
            <p className="text-xs text-muted-foreground/70">Por crear</p>
          </div>
        </div>
        <div className="mt-0.5">{action}</div>
      </div>
    </div>
  )
}
