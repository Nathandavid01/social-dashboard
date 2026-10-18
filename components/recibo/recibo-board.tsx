'use client'

import { useMemo, useState } from 'react'
import styles from './recibo-board.module.css'
import { ReciboThumbnail } from './recibo-thumbnail'
import { Bot, Loader2, Search, Play } from 'lucide-react'
import { ClientLogo } from '@/components/clients/client-logo'
import { EnviarAlCliente } from '@/components/entregas/enviar-al-cliente'
import { ReciboCaption } from '@/components/recibo/recibo-caption'
import { ReciboFeedback } from '@/components/recibo/recibo-feedback'
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
import { filterReciboIdeas } from '@/lib/recibo/search'
import { formatUploadCounts, reciboUploadCounts } from '@/lib/recibo/upload-counts'
import { displayCaptionDraft } from '@/lib/utils/caption-draft'
import { formatCadenceDaysEs } from '@/lib/utils/client-cadence'
import { RECIBO_HELD_CLIENT_IDS } from '@/lib/recibo/board-ideas'
import { isAgendadoIdea, isPublishedIdea, isClientApproved } from '@/lib/utils/client-pool-state'
import { coverUrlForIdea } from '@/lib/pipeline/editor-history'
import { editedEntregasVideoId, isReciboGraphic } from '@/lib/recibo/preview'
import { cn } from '@/lib/utils'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Recibo — intake for clients with edit_mode='ai', plus any cut Eric uploaded (v5.113).
 * Spaces follow the client's posting cadence. Occupied cards keep caption, internal
 * dislike reason, and publish.
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

/** A cover must describe the same uploaded file the card will open. */
function coverForVideo(idea: IdeaWithPipeline, videoId: string | null | undefined): string | null {
  return coverUrlForIdea({ ...idea, videos: (idea.videos ?? []).filter(video => video.id === videoId) })
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
                ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
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
  const [query, setQuery] = useState('')
  const [clientFilter, setClientFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openIdea, setOpenIdea] = useState<string | null>(null)
  const states = [
    { id: 'all', label: 'Todas' },
    { id: 'pending', label: 'Por enviar' },
    { id: 'sent', label: 'Enlace creado' },
    { id: 'changes', label: 'Cambios solicitados' },
    { id: 'approved', label: 'Aprobadas' },
    { id: 'scheduled', label: 'Programadas' },
  ]
  function stateOf(idea: IdeaWithPipeline & { entregas_review_status?: string | null }) {
    if (isAgendadoIdea(idea)) return 'scheduled'
    if (isClientApproved(idea)) return 'approved'
    if ([idea.staff_client_approval, idea.client_review_status, idea.entregas_review_status].includes('rejected')) return 'changes'
    return sent.has(idea.id) ? 'sent' : 'pending'
  }
  const week = weekFromToday(todayISO)
  const occupancy = occupancyIdeas ?? ideas
  const queryNeedle = query.trim().toLocaleLowerCase('es')

  const displayIdeas = useMemo(() => {
    const seen = new Set(ideas.map((idea) => idea.id))
    const extra = occupancy.filter((idea) => {
      if (seen.has(idea.id)) return false
      if (isPublishedIdea(idea)) return false
      return occupyingVideo(idea) != null
    })
    return [...ideas, ...extra]
  }, [ideas, occupancy])

  const clients = [...new Map([...aiClients.filter(client => !RECIBO_HELD_CLIENT_IDS.has(client.id)), ...displayIdeas.map(idea => ({
    id: idea.client_id, name: idea.client?.name || aiClients.find(client => client.id === idea.client_id)?.name || 'Cliente',
  }))].map(client => [client.id, client])).values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const matchingIdeas = filterReciboIdeas(displayIdeas, query).filter(idea => clientFilter === 'all' || idea.client_id === clientFilter)
  const visibleIdeas = matchingIdeas.filter(idea => statusFilter === 'all' || stateOf(idea) === statusFilter)
  const visibleIds = useMemo(() => new Set(visibleIdeas.map((idea) => idea.id)), [visibleIdeas])
  const clientNameMatches = (name: string) => !queryNeedle || name.toLocaleLowerCase('es').includes(queryNeedle)

  const byClient = useMemo(() => {
    const known = new Map(aiClients.map((client) => [client.id, client]))
    const map = new Map<string, { client: { id: string; name: string; logo_url?: string | null; ai: boolean }; ideas: IdeaWithPipeline[] }>()
    for (const client of aiClients) {
      if (RECIBO_HELD_CLIENT_IDS.has(client.id)) continue
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
    for (const idea of visibleIdeas) {
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
    return [...map.values()]
      .filter((entry) => (clientFilter === 'all' || entry.client.id === clientFilter) && (statusFilter === 'all' || entry.ideas.length > 0) && (!queryNeedle || clientNameMatches(entry.client.name) || entry.ideas.length > 0))
      .sort((a, b) => a.client.name.localeCompare(b.client.name, 'es'))
  }, [visibleIdeas, aiClients, queryNeedle, clientFilter, statusFilter])

  async function fillCaptions() {
    const missing = visibleIdeas.filter(
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
    <div className={`${styles.board} mx-auto w-full max-w-6xl space-y-6 sm:space-y-8`} data-testid="recibo-board">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Bot className="h-7 w-7 shrink-0 text-amber-700" aria-hidden="true" />
            Recibo
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Revisa las entregas, organiza las aprobaciones y prepara tu próxima publicación.
            Los espacios respetan la cadencia de cada cliente.
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
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
        >
          {filling && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {fillLabel ?? 'Completar captions visibles'}
        </button>
      </header>

      <section aria-label="Filtros de Recibo" className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_240px_auto]">
          <label className="space-y-1 text-xs text-muted-foreground">Buscar pieza o cliente
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true" />
              <input type="search" aria-label="Buscar cliente o idea" data-testid="recibo-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Título o nombre del cliente…" className="block h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm text-foreground" />
            </div>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Cliente
            <select aria-label="Filtrar por cliente" value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="block h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">
              <option value="all">Todos los clientes</option>
              {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setQuery(''); setClientFilter('all'); setStatusFilter('all') }} className="self-end rounded-xl border border-border px-4 py-3 text-xs">Limpiar filtros</button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Resumen por estado">
          {states.map(state => <button key={state.id} type="button" aria-pressed={statusFilter === state.id} onClick={() => setStatusFilter(state.id)} className={`rounded-xl border px-4 py-3 text-left text-xs transition-colors ${statusFilter === state.id ? 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-500' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            {state.label} <span className="mt-2 block text-2xl font-semibold tracking-tight">{state.id === 'all' ? matchingIdeas.length : matchingIdeas.filter(idea => stateOf(idea) === state.id).length}</span>
          </button>)}
        </div>
        <p className="text-xs text-muted-foreground" role="status">{visibleIdeas.length} de {displayIdeas.length} piezas · Aprobada no significa programada ni publicada.</p>
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Cómo leer los estados</summary><p className="mt-2">Los contadores respetan la búsqueda y el cliente seleccionado. Enlace creado no confirma la recepción del cliente. Las publicaciones se consultan en el calendario.</p></details>
      </section>

      {byClient.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-sm text-muted-foreground">
          {queryNeedle || clientFilter !== 'all' || statusFilter !== 'all' ? 'Ningún video coincide con esos filtros.' : 'No hay videos por aprobar ni por programar en Metricool.'}
        </div>
      ) : (
        <>
          {actionableIdeas.length > 0 && <details className="rounded-2xl border border-border bg-white p-4 shadow-sm"><summary className="cursor-pointer text-sm font-medium">Crear enlace de revisión para el cliente</summary><div className="mt-4"><p className="mb-3 text-xs text-muted-foreground">La selección del enlace es independiente de los filtros del tablero.</p><EnviarAlCliente ideas={semanaIdeas.length ? semanaIdeas : actionableIdeas} /></div></details>}

          <ul className="space-y-8">
            {byClient.map(({ client, ideas: clientIdeas }) => {
              const cadence = cadenceByClient[client.id] ?? {}
              const postingDays = cadence.postingDays ?? []
              const videoIdeas = displayIdeas.filter((idea) => idea.client_id === client.id && !isReciboGraphic(idea))
              const graphicIdeas = clientIdeas.filter((idea) => isReciboGraphic(idea))
              const occupancyForClient = occupancy.filter((idea) => {
                if (idea.client_id !== client.id || isReciboGraphic(idea)) return false
                return true
              })
              const spaces = buildReciboCadenceSpaces({
                postingDays,
                ideas: videoIdeas,
                occupancyIdeas: occupancyForClient,
                week,
                padEmpty: client.ai,
              })
              const filteredSpaces = spaces.filter(space => space.kind === 'occupied' ? visibleIds.has(space.idea.id) : statusFilter === 'all' && (!queryNeedle || clientNameMatches(client.name)))
              const clientMonths = reciboMonthlyUploadCounts(
                occupancy.filter((idea) => idea.client_id === client.id),
                todayISO ?? new Date().toISOString().slice(0, 10),
              )
              const filled = filteredSpaces.filter((space) => space.kind === 'occupied').length
              const pending = filteredSpaces.filter((space) => space.kind === 'empty').length
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
                            className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"
                          >
                            AI
                          </span>
                        ) : <span data-testid="recibo-manual-badge" className="text-xs text-muted-foreground">Entrega puntual</span>}
                      </div>
                      <p className="text-xs text-muted-foreground" data-testid={`recibo-client-counts-${client.id}`}>
                        {showUploadCounts
                          ? `${formatUploadCounts(reciboUploadCounts(clientIdeas))} · Publicados ${publishedByClient[client.id] ?? 0}`
                          : client.ai && postingDays.length
                            ? `${postingDays.length} espacios esta semana · ${formatCadenceDaysEs(postingDays)} · ${filled} ocupados · ${pending} pendientes`
                            : clientIdeas.length === 0
                              ? 'Sin cadencia · sin videos'
                              : `${clientIdeas.length} video${clientIdeas.length === 1 ? '' : 's'} · Sin cadencia`}
                      </p>
                      <MonthCounts counts={clientMonths} testId={`recibo-client-months-${client.id}`} compact />
                    </div>
                  </div>

                  {filteredSpaces.length === 0 && graphicIdeas.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
                      No hay videos editados en el filtro actual.
                    </p>
                  ) : (
                    <div className="space-y-6">
                      {filteredSpaces.length > 0 ? (
                        <section aria-label={`${client.name} · Videos`} className="space-y-3">
                          <h2 className="text-sm font-semibold">
                            Videos · {filled} ocupados
                            {pending ? ` · ${pending} pendientes` : ''}
                          </h2>
                          <ul className="grid grid-cols-1 items-start gap-4 min-[400px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                            {filteredSpaces.map((space) => {
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
                              const approved = space.tone === 'approved' || space.tone === 'scheduled'
                              const scheduled = isAgendadoIdea(idea)
                              const coverUrl = coverForVideo(idea, editedVideoId ?? occupy?.id)
                              const graphic = isReciboGraphic(idea)
                              return (
                                <li
                                  key={idea.id}
                                  data-testid={`recibo-idea-${idea.id}`}
                                  data-tone={space.tone}
                                  className={cn(
                                    'flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md',
                                    space.tone === 'scheduled'
                                      ? 'border-violet-500/70 ring-1 ring-violet-500/30'
                                      : space.tone === 'approved'
                                        ? 'border-emerald-500/70 ring-1 ring-emerald-500/30'
                                        : 'border-amber-500/70 ring-1 ring-amber-500/30',
                                  )}
                                >
                                  <button type="button" aria-expanded={openIdea === idea.id} onClick={() => setOpenIdea(openIdea === idea.id ? null : idea.id)} aria-label={openIdea === idea.id ? `Cerrar revisión de ${ideaTitle(idea)}` : `Abrir video y caption de ${ideaTitle(idea)}`} className="group relative block w-full overflow-hidden text-left">
                                    {editedVideoId || occupy?.id ? <ReciboThumbnail key={editedVideoId ?? occupy?.id} videoId={(editedVideoId ?? occupy?.id)!} title={ideaTitle(idea)} coverUrl={coverUrl} /> : <span className="block aspect-[9/16] bg-slate-100" />}
                                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-12 text-xs font-medium text-white"><Play aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full bg-white/95 p-2 text-slate-900 shadow-sm" />{openIdea === idea.id ? 'Cerrar revisión' : 'Abrir video y caption'}</span>
                                    <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-semibold shadow-sm ${stateOf(idea) === 'approved' ? 'bg-emerald-50 text-emerald-800' : stateOf(idea) === 'changes' ? 'bg-rose-50 text-rose-800' : stateOf(idea) === 'scheduled' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-900'}`}>{states.find(state => state.id === stateOf(idea))?.label}</span>
                                  </button>
                                  <div className="space-y-2 p-3">
                                    <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug" title={ideaTitle(idea)}>{ideaTitle(idea)}</h3>
                                    <p className="text-[11px] text-muted-foreground">{occupy?.uploaded_at ? `Recibido ${new Date(occupy.uploaded_at).toLocaleDateString('es-PR', { timeZone: 'America/Puerto_Rico' })}` : 'Fecha de recepción no disponible'}</p>
                                    {openIdea !== idea.id && <p className="line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">{caption || 'Sin caption'}</p>}
                                  </div>
                                  {openIdea === idea.id && <>
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
                                        hidePublished={scheduled}
                                      />
                                    ) : null}
                                    {hasEdit && client.ai && <ReciboDeleteButton ideaId={idea.id} title={ideaTitle(idea)} />}
                                  </div>
                                  <ReciboCaption onSaved={text => setCaptionOverrides(prev => ({ ...prev, [idea.id]: text }))} ideaId={idea.id} caption={caption} disabled={!hasEdit || filling} />
                                  <ReciboFeedback ideaId={idea.id} />
                                  </>}
                                  {!graphic && hasEdit && (
                                    <ReciboPublishButton
                                      ideaId={idea.id}
                                      approved={approved}
                                      scheduled={scheduled}
                                      todayISO={todayISO ?? ''}
                                      spaceDateISO={space.dateISO ?? idea.publish_date ?? null}
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
                          <ul className="grid grid-cols-1 items-start gap-4 min-[400px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                            {graphicIdeas.map((idea) => {
                              const hasEdit = !!editedEntregasVideoId(idea)
                              const editedVideoId = editedEntregasVideoId(idea)
                              const caption = captionOf(idea, captionOverrides)
                              const approved = idea.staff_client_approval === 'approved' || idea.client_review_status === 'approved'
                              return (
                                <li
                                  key={idea.id}
                                  data-testid={`recibo-idea-${idea.id}`}
                                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md"
                                >
                                  <button type="button" aria-expanded={openIdea === idea.id} onClick={() => setOpenIdea(openIdea === idea.id ? null : idea.id)} aria-label={openIdea === idea.id ? `Cerrar revisión de ${ideaTitle(idea)}` : `Abrir gráfico y caption de ${ideaTitle(idea)}`} className="group relative block w-full overflow-hidden text-left">
                                    {editedVideoId ? <ReciboThumbnail key={editedVideoId} videoId={editedVideoId} title={ideaTitle(idea)} coverUrl={coverForVideo(idea, editedVideoId)} image /> : <span className="block aspect-[4/5] bg-slate-100" />}
                                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-12 text-xs font-medium text-white">{openIdea === idea.id ? 'Cerrar revisión' : 'Abrir gráfico y caption'}</span>
                                    <span className="absolute right-2 top-2 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-800 shadow-sm">{states.find(state => state.id === stateOf(idea))?.label}</span>
                                  </button>
                                  <div className="space-y-2 p-3">
                                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug">Gráfico · {ideaTitle(idea)}</h3>
                                    {openIdea !== idea.id && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{caption || 'Sin caption'}</p>}
                                  </div>
                                  {openIdea === idea.id && <>
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
                                  <ReciboCaption onSaved={text => setCaptionOverrides(prev => ({ ...prev, [idea.id]: text }))} ideaId={idea.id} caption={caption} disabled={!hasEdit || filling} />
                                  <ReciboFeedback ideaId={idea.id} />
                                  </>}
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
