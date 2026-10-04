'use client'

import { useMemo, useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { ClientLogo } from '@/components/clients/client-logo'
import { EnviarAlCliente } from '@/components/entregas/enviar-al-cliente'
import { ReciboCaption } from '@/components/recibo/recibo-caption'
import { ReciboDeleteButton } from '@/components/recibo/recibo-delete'
import { ReciboDownloadButton } from '@/components/recibo/recibo-download'
import { ReciboPublishButton, ReciboStatusMarks } from '@/components/recibo/recibo-card-status'
import { ReciboVideoPreview } from '@/components/recibo/recibo-video-preview'
import { VideoCover } from '@/components/recording/video-cover'
import { useToast } from '@/lib/hooks/use-toast'
import { fillReciboCaption } from '@/lib/actions/recibo-captions'
import { ideaTieneEditadoEntregas } from '@/lib/entregas/enviar-al-cliente'
import { rangoSemana } from '@/lib/entregas/dias'
import {
  buildReciboCadenceSpaces,
  occupyingVideo,
  reciboMonthlyUploadCounts,
  type ReciboMonthCount,
} from '@/lib/recibo/cadence-spaces'
import { formatUploadCounts, reciboUploadCounts } from '@/lib/recibo/upload-counts'
import { displayCaptionDraft } from '@/lib/utils/caption-draft'
import { formatCadenceDaysEs } from '@/lib/utils/client-cadence'
import { isAgendadoIdea, isPublishedIdea } from '@/lib/utils/client-pool-state'
import { coverUrlForIdea } from '@/lib/pipeline/editor-history'
import { editedEntregasVideoId, isReciboGraphic } from '@/lib/recibo/preview'
import { cn } from '@/lib/utils'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Recibo — intake for clients with edit_mode='ai', plus any cut Eric uploaded (v5.113).
 * Spaces follow the client's posting cadence. Occupied cards keep caption + publish.
 */

function captionOf(idea: IdeaWithPipeline, overrides: Record<string, string>): string {
  if (overrides[idea.id] != null) return overrides[idea.id]
  return (idea.generated_caption ?? '').trim() || displayCaptionDraft(idea.caption_draft)
}

function enEstaSemana(idea: IdeaWithPipeline, semana = 0): boolean {
  const fecha = idea.publish_date || idea.submitted_at?.slice(0, 10) || idea.created_at?.slice(0, 10)
  if (!fecha) return false
  const { desde, hasta } = rangoSemana(undefined, semana)
  return fecha >= desde && fecha <= hasta
}

function ideaTitle(idea: IdeaWithPipeline): string {
  return idea.title?.trim() || idea.hook?.trim() || 'Sin título'
}

function weekFromToday(todayISO?: string) {
  if (!todayISO) return rangoSemana()
  const [year, month, day] = todayISO.split('-').map(Number)
  return rangoSemana(new Date(year, month - 1, day, 12))
}

export type ReciboCadence = {
  postingDays?: number[] | null
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
  metricool?: boolean
}

function MonthCounts({
  counts,
  testId,
  compact = false,
}: {
  counts: { total: number; months: ReciboMonthCount[] }
  testId: string
  compact?: boolean
}) {
  return (
    <div data-testid={testId} className={cn(compact ? 'text-xs text-muted-foreground' : 'space-y-2')}>
      {!compact ? (
        <h2 className="text-sm font-semibold">Subidas por mes</h2>
      ) : null}
      <ul className={cn('flex flex-wrap gap-2', compact && 'mt-1')}>
        {counts.months.map((month) => (
          <li
            key={month.key}
            data-current={month.current ? 'true' : 'false'}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
              month.current
                ? 'bg-violet-500/20 text-violet-100 ring-1 ring-violet-400/50'
                : 'bg-muted/50 text-muted-foreground',
            )}
          >
            <span className="capitalize">{month.label}</span>
            {' · '}
            {month.count}
          </li>
        ))}
        <li className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-foreground">
          Total {counts.total}
        </li>
      </ul>
    </div>
  )
}

export function ReciboBoard({
  ideas,
  aiClients,
  showUploadCounts = false,
  sentIdeaIds = [],
  cadenceByClient = {},
  occupancyIdeas,
  todayISO,
  publishedTotal = 0,
  publishedByClient = {},
}: {
  ideas: IdeaWithPipeline[]
  aiClients: { id: string; name: string; logo_url?: string | null }[]
  showUploadCounts?: boolean
  sentIdeaIds?: string[]
  cadenceByClient?: Record<string, ReciboCadence>
  occupancyIdeas?: IdeaWithPipeline[]
  todayISO?: string
  publishedTotal?: number
  publishedByClient?: Record<string, number>
}) {
  const sent = new Set(sentIdeaIds)
  const { toast } = useToast()
  const [captionOverrides, setCaptionOverrides] = useState<Record<string, string>>({})
  const [filling, setFilling] = useState(false)
  const [fillLabel, setFillLabel] = useState<string | null>(null)
  const week = weekFromToday(todayISO)
  const occupancy = occupancyIdeas ?? ideas

  const displayIdeas = useMemo(() => {
    const seen = new Set(ideas.map((idea) => idea.id))
    const extra = occupancy.filter((idea) => {
      if (seen.has(idea.id)) return false
      if (isPublishedIdea(idea) || isAgendadoIdea(idea)) return false
      return occupyingVideo(idea) != null
    })
    return [...ideas, ...extra]
  }, [ideas, occupancy])

  const byClient = useMemo(() => {
    const known = new Map(aiClients.map((client) => [client.id, client]))
    const map = new Map<string, { client: { id: string; name: string; logo_url?: string | null; ai: boolean }; ideas: IdeaWithPipeline[] }>()
    for (const client of aiClients) {
      map.set(client.id, {
        client: {
          id: client.id,
          name: client.name,
          logo_url: client.logo_url ?? null,
          ai: true,
        },
        ideas: [],
      })
    }
    for (const idea of displayIdeas) {
      const entry = map.get(idea.client_id)
      if (entry) entry.ideas.push(idea)
      else {
        map.set(idea.client_id, {
          client: {
            id: idea.client_id,
            name: idea.client?.name?.trim() || 'Cliente',
            logo_url: idea.client?.logo_url ?? known.get(idea.client_id)?.logo_url ?? null,
            ai: known.has(idea.client_id),
          },
          ideas: [idea],
        })
      }
    }
    return [...map.values()].sort((a, b) => a.client.name.localeCompare(b.client.name, 'es'))
  }, [displayIdeas, aiClients])

  async function fillCaptions() {
    const missing = ideas.filter(
      (idea) => idea.status !== 'descartada' && !!editedEntregasVideoId(idea) && !captionOf(idea, captionOverrides),
    )
    if (missing.length === 0) {
      toast({ title: 'Todos los videos ya tienen caption' })
      return
    }
    setFilling(true)
    const byCaptionClient = new Map<string, { titulo: string; caption: string }[]>()
    for (const idea of ideas) {
      const text = captionOf(idea, captionOverrides)
      if (!text) continue
      const list = byCaptionClient.get(idea.client_id) ?? []
      list.push({ titulo: idea.title ?? '', caption: text })
      byCaptionClient.set(idea.client_id, list)
    }
    let written = 0
    let failed = 0
    for (const idea of missing) {
      setFillLabel(`Poniendo captions ${written + failed + 1}/${missing.length}`)
      const hermanos = (byCaptionClient.get(idea.client_id) ?? []).slice(-8)
      const res = await fillReciboCaption(idea.id, hermanos)
      if (res.caption) {
        setCaptionOverrides((prev) => ({ ...prev, [idea.id]: res.caption! }))
        const list = byCaptionClient.get(idea.client_id) ?? []
        list.push({ titulo: idea.title ?? '', caption: res.caption })
        byCaptionClient.set(idea.client_id, list)
        written += 1
      } else {
        failed += 1
        toast({
          title: ideaTitle(idea),
          description: res.error || 'No se pudo escribir el caption',
          variant: 'destructive',
        })
      }
    }
    setFilling(false)
    setFillLabel(null)
    toast({
      title: failed ? `Captions listos: ${written}. Fallaron ${failed}.` : `Captions listos: ${written}`,
    })
  }

  const actionableIdeas = useMemo(
    () => ideas.filter((idea) => !isReciboGraphic(idea) && aiClients.some((client) => client.id === idea.client_id)),
    [ideas, aiClients],
  )
  const semanaIdeas = useMemo(
    () => actionableIdeas.filter((i) => i.status !== 'descartada' && enEstaSemana(i, 0) && ideaTieneEditadoEntregas(i)),
    [actionableIdeas],
  )
  const uploadCounts = useMemo(() => reciboUploadCounts(ideas), [ideas])
  const monthly = useMemo(
    () => reciboMonthlyUploadCounts(occupancy, todayISO ?? new Date().toISOString().slice(0, 10)),
    [occupancy, todayISO],
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6" data-testid="recibo-board">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            <Bot className="h-5 w-5 shrink-0 text-violet-400" aria-hidden="true" />
            Recibo
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Espacios según la cadencia de cada cliente. Se llenan con los videos
            que se van subiendo. Verde = aprobado o ya en Metricool. Ámbar = pendiente.
          </p>
          {showUploadCounts ? (
            <p className="mt-2 text-sm text-foreground" data-testid="recibo-upload-counts">
              {formatUploadCounts(uploadCounts)}
              {' · '}
              Publicados {publishedTotal}
            </p>
          ) : null}
          <div className="mt-3">
            <MonthCounts counts={monthly} testId="recibo-monthly-counts" />
          </div>
        </div>
        <button
          type="button"
          disabled={filling}
          onClick={() => void fillCaptions()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-violet-500/20 px-4 text-xs font-semibold text-violet-100 disabled:opacity-60"
        >
          {filling && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {fillLabel ?? 'Poner captions'}
        </button>
      </header>

      {byClient.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
          No hay videos por aprobar ni por programar en Metricool.
        </div>
      ) : (
        <>
          {actionableIdeas.length > 0 && <EnviarAlCliente ideas={semanaIdeas.length ? semanaIdeas : actionableIdeas} />}

          <ul className="space-y-8">
            {byClient.map(({ client, ideas: clientIdeas }) => {
              const cadence = cadenceByClient[client.id] ?? {}
              const postingDays = cadence.postingDays ?? []
              const videoIdeas = clientIdeas.filter((idea) => !isReciboGraphic(idea))
              const graphicIdeas = clientIdeas.filter((idea) => isReciboGraphic(idea))
              const occupancyForClient = occupancy.filter(
                (idea) => idea.client_id === client.id && !isReciboGraphic(idea),
              )
              const spaces = buildReciboCadenceSpaces({
                postingDays,
                ideas: videoIdeas,
                occupancyIdeas: occupancyForClient,
                week,
              })
              const clientMonths = reciboMonthlyUploadCounts(
                occupancy.filter((idea) => idea.client_id === client.id),
                todayISO ?? new Date().toISOString().slice(0, 10),
              )
              const filled = spaces.filter((space) => space.kind === 'occupied').length
              const pending = spaces.filter((space) => space.kind === 'empty').length
              return (
                <li key={client.id} className="space-y-4">
                  <div className="flex items-center gap-3 px-1">
                    <ClientLogo name={client.name} logoUrl={client.logo_url} className="h-11 w-11 ring-2 ring-border" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-semibold">{client.name}</span>
                        {client.ai ? (
                          <span
                            data-testid="recibo-ai-badge"
                            className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300"
                          >
                            AI
                          </span>
                        ) : <span data-testid="recibo-manual-badge" className="text-xs text-muted-foreground">Entrega puntual</span>}
                      </div>
                      <p className="text-xs text-muted-foreground" data-testid={`recibo-client-counts-${client.id}`}>
                        {showUploadCounts
                          ? `${formatUploadCounts(reciboUploadCounts(clientIdeas))} · Publicados ${publishedByClient[client.id] ?? 0}`
                          : postingDays.length
                            ? `${postingDays.length} espacios esta semana · ${formatCadenceDaysEs(postingDays)} · ${filled} ocupados · ${pending} pendientes`
                            : clientIdeas.length === 0
                              ? 'Sin cadencia · sin videos'
                              : `${clientIdeas.length} video${clientIdeas.length === 1 ? '' : 's'} · Sin cadencia`}
                      </p>
                      <MonthCounts counts={clientMonths} testId={`recibo-client-months-${client.id}`} compact />
                    </div>
                  </div>

                  {spaces.length === 0 && graphicIdeas.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
                      No hay videos editados en el filtro actual.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {spaces.length > 0 ? (
                        <section aria-label={`${client.name} · Videos`} className="space-y-3">
                          <h2 className="text-sm font-semibold">
                            Videos · {filled} ocupados
                            {pending ? ` · ${pending} pendientes` : ''}
                          </h2>
                          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                            {spaces.map((space) => {
                              if (space.kind === 'empty') {
                                return (
                                  <li
                                    key={space.key}
                                    data-testid="recibo-space-empty"
                                    className="flex min-h-[16rem] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/20 text-center"
                                  >
                                    <p className="text-sm font-semibold text-muted-foreground">Pendiente</p>
                                    <p className="mt-1 px-4 text-xs text-muted-foreground">
                                      Espacio de cadencia sin video todavía
                                      {space.dateISO ? ` · ${space.dateISO}` : ''}
                                    </p>
                                  </li>
                                )
                              }
                              const idea = space.idea
                              const hasEdit = !!editedEntregasVideoId(idea)
                              const editedVideoId = editedEntregasVideoId(idea)
                              const occupy = occupyingVideo(idea)
                              const caption = captionOf(idea, captionOverrides)
                              const approved = space.tone === 'approved'
                              const coverUrl = coverUrlForIdea(idea)
                              const graphic = isReciboGraphic(idea)
                              return (
                                <li
                                  key={idea.id}
                                  data-testid={`recibo-idea-${idea.id}`}
                                  data-tone={space.tone}
                                  className={cn(
                                    'flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b from-card to-card/80 shadow-md shadow-black/20',
                                    space.tone === 'approved'
                                      ? 'border-emerald-500/70 ring-1 ring-emerald-500/30'
                                      : 'border-amber-500/70 ring-1 ring-amber-500/30',
                                  )}
                                >
                                  <div className="relative bg-zinc-950 px-3 pb-2 pt-3 sm:px-4">
                                    {graphic && <p className="mb-2 text-xs font-semibold text-violet-300">Gráfico · {ideaTitle(idea)}</p>}
                                    <div className="mx-auto w-full max-w-[min(100%,280px)]">
                                      {hasEdit ? (
                                        <ReciboVideoPreview
                                          image={graphic}
                                          title={ideaTitle(idea)}
                                          ideaId={idea.id}
                                          hasEdited={hasEdit}
                                          expectedVideoId={editedVideoId ?? undefined}
                                        />
                                      ) : coverUrl ? (
                                        <div className="relative aspect-[9/16] overflow-hidden rounded-[1.25rem] bg-black">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={coverUrl} alt={`Portada de ${ideaTitle(idea)}`} className="h-full w-full object-cover" />
                                        </div>
                                      ) : occupy?.id ? (
                                        <div className="relative aspect-[9/16] overflow-hidden rounded-[1.25rem] bg-black">
                                          <VideoCover videoId={occupy.id} title={ideaTitle(idea)} />
                                        </div>
                                      ) : (
                                        <ReciboVideoPreview image={graphic} title={ideaTitle(idea)} ideaId={idea.id} hasEdited={false} />
                                      )}
                                    </div>
                                    {editedVideoId && (
                                      <ReciboDownloadButton ideaId={idea.id} videoId={editedVideoId} title={ideaTitle(idea)} />
                                    )}
                                    {hasEdit ? (
                                      <ReciboStatusMarks
                                        ideaId={idea.id}
                                        clientId={idea.client_id}
                                        approved={approved}
                                        sent={sent.has(idea.id)}
                                        postedStatus={idea.manual_posted_status ?? null}
                                      />
                                    ) : null}
                                    {hasEdit && client.ai && <ReciboDeleteButton ideaId={idea.id} title={ideaTitle(idea)} />}
                                  </div>
                                  <ReciboCaption ideaId={idea.id} caption={caption} disabled={!hasEdit || filling} />
                                  {!graphic && hasEdit && (
                                    <ReciboPublishButton
                                      ideaId={idea.id}
                                      approved={approved}
                                      todayISO={todayISO ?? ''}
                                      cadence={cadence}
                                    />
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </section>
                      ) : null}

                      {graphicIdeas.length > 0 ? (
                        <section aria-label={`${client.name} · Gráficos`} className="space-y-3">
                          <h2 className="text-sm font-semibold">Gráficos · {graphicIdeas.length}</h2>
                          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                            {graphicIdeas.map((idea) => {
                              const hasEdit = !!editedEntregasVideoId(idea)
                              const editedVideoId = editedEntregasVideoId(idea)
                              const caption = captionOf(idea, captionOverrides)
                              const approved = idea.staff_client_approval === 'approved' || idea.client_review_status === 'approved'
                              return (
                                <li
                                  key={idea.id}
                                  data-testid={`recibo-idea-${idea.id}`}
                                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-card/80 shadow-md shadow-black/20"
                                >
                                  <div className="relative bg-zinc-950 px-3 pb-2 pt-3 sm:px-4">
                                    <p className="mb-2 text-xs font-semibold text-violet-300">Gráfico · {ideaTitle(idea)}</p>
                                    <div className="mx-auto w-full max-w-[min(100%,280px)]">
                                      <ReciboVideoPreview image title={ideaTitle(idea)} ideaId={idea.id} hasEdited={hasEdit} expectedVideoId={editedVideoId ?? undefined} />
                                    </div>
                                    {editedVideoId && (
                                      <ReciboDownloadButton ideaId={idea.id} videoId={editedVideoId} title={ideaTitle(idea)} />
                                    )}
                                    <ReciboStatusMarks
                                      ideaId={idea.id}
                                      clientId={idea.client_id}
                                      approved={approved}
                                      sent={sent.has(idea.id)}
                                      postedStatus={idea.manual_posted_status ?? null}
                                    />
                                    {client.ai && <ReciboDeleteButton ideaId={idea.id} title={ideaTitle(idea)} />}
                                  </div>
                                  <ReciboCaption ideaId={idea.id} caption={caption} disabled={!hasEdit || filling} />
                                </li>
                              )
                            })}
                          </ul>
                        </section>
                      ) : null}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
