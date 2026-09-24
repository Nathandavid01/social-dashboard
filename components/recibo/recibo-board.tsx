'use client'

import { useMemo, useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { ClientLogo } from '@/components/clients/client-logo'
import { EnviarAlCliente } from '@/components/entregas/enviar-al-cliente'
import { ReciboCaption } from '@/components/recibo/recibo-caption'
import { ReciboDeleteButton } from '@/components/recibo/recibo-delete'
import { ReciboPublishButton, ReciboStatusMarks } from '@/components/recibo/recibo-card-status'
import { ReciboVideoPreview } from '@/components/recibo/recibo-video-preview'
import { useToast } from '@/lib/hooks/use-toast'
import { fillReciboCaption } from '@/lib/actions/recibo-captions'
import { ideaTieneEditadoEntregas } from '@/lib/entregas/enviar-al-cliente'
import { rangoSemana } from '@/lib/entregas/dias'
import { formatUploadCounts, reciboUploadCounts } from '@/lib/recibo/upload-counts'
import { displayCaptionDraft } from '@/lib/utils/caption-draft'
import { editedEntregasVideoId } from '@/lib/recibo/preview'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Recibo — intake for clients with edit_mode='ai', plus any cut Eric uploaded (v5.113).
 * Under each video, only the caption. No title, approval, or send button.
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

export type ReciboCadence = {
  postingDays?: number[] | null
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
  metricool?: boolean
}

export function ReciboBoard({
  ideas,
  aiClients,
  showUploadCounts = false,
  sentIdeaIds = [],
  cadenceByClient = {},
  todayISO,
}: {
  ideas: IdeaWithPipeline[]
  aiClients: { id: string; name: string; logo_url?: string | null }[]
  showUploadCounts?: boolean
  sentIdeaIds?: string[]
  cadenceByClient?: Record<string, ReciboCadence>
  todayISO?: string
}) {
  const sent = new Set(sentIdeaIds)
  const { toast } = useToast()
  const [captionOverrides, setCaptionOverrides] = useState<Record<string, string>>({})
  const [filling, setFilling] = useState(false)
  const [fillLabel, setFillLabel] = useState<string | null>(null)

  const filtered = ideas

  const byClient = useMemo(() => {
    const known = new Map(aiClients.map((client) => [client.id, client]))
    const map = new Map<string, { client: { id: string; name: string; logo_url?: string | null; ai: boolean }; ideas: IdeaWithPipeline[] }>()
    for (const idea of filtered) {
      const entry = map.get(idea.client_id)
      if (entry) entry.ideas.push(idea)
      else {
        map.set(idea.client_id, {
          client: {
            id: idea.client_id,
            name: idea.client?.name?.trim() || 'Cliente',
            logo_url: idea.client?.logo_url ?? known.get(idea.client_id)?.logo_url ?? null,
            // A human-editor client can be here through a cut Eric uploaded (v5.113): no AI badge for it.
            ai: known.has(idea.client_id),
          },
          ideas: [idea],
        })
      }
    }
    return [...map.values()].sort((a, b) => a.client.name.localeCompare(b.client.name, 'es'))
  }, [filtered, aiClients])

  async function fillCaptions() {
    const missing = ideas.filter(
      (idea) => idea.status !== 'descartada' && ideaTieneEditadoEntregas(idea) && !captionOf(idea, captionOverrides),
    )
    if (missing.length === 0) {
      toast({ title: 'Todos los videos ya tienen caption' })
      return
    }
    setFilling(true)
    const byClient = new Map<string, { titulo: string; caption: string }[]>()
    for (const idea of ideas) {
      const text = captionOf(idea, captionOverrides)
      if (!text) continue
      const list = byClient.get(idea.client_id) ?? []
      list.push({ titulo: idea.title ?? '', caption: text })
      byClient.set(idea.client_id, list)
    }
    let written = 0
    let failed = 0
    for (const idea of missing) {
      setFillLabel(`Poniendo captions ${written + failed + 1}/${missing.length}`)
      const hermanos = (byClient.get(idea.client_id) ?? []).slice(-8)
      const res = await fillReciboCaption(idea.id, hermanos)
      if (res.caption) {
        setCaptionOverrides((prev) => ({ ...prev, [idea.id]: res.caption! }))
        const list = byClient.get(idea.client_id) ?? []
        list.push({ titulo: idea.title ?? '', caption: res.caption })
        byClient.set(idea.client_id, list)
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

  // Human-client deliveries are individual reviews: bulk actions affect whole
  // ideas, including their other cuts. Keep them in the client's editing workflow.
  const actionableIdeas = useMemo(
    () => ideas.filter((idea) => aiClients.some((client) => client.id === idea.client_id)),
    [ideas, aiClients],
  )
  const semanaIdeas = useMemo(
    () => actionableIdeas.filter((i) => i.status !== 'descartada' && enEstaSemana(i, 0) && ideaTieneEditadoEntregas(i)),
    [actionableIdeas],
  )
  const uploadCounts = useMemo(() => reciboUploadCounts(ideas), [ideas])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6" data-testid="recibo-board">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            <Bot className="h-5 w-5 shrink-0 text-violet-400" aria-hidden="true" />
            Recibo
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Aquí están los videos por aprobar y los que faltan por postear o programar en Metricool.
            El caption imita lo ya publicado. Sin auto-post.
          </p>
          {showUploadCounts ? (
            <p className="mt-2 text-sm text-foreground" data-testid="recibo-upload-counts">
              {formatUploadCounts(uploadCounts)}
            </p>
          ) : null}
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
            {byClient.map(({ client, ideas: clientIdeas }) => (
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
                        ? formatUploadCounts(reciboUploadCounts(clientIdeas))
                        : clientIdeas.length === 0
                          ? 'Sin videos en el filtro actual'
                          : `${clientIdeas.length} video${clientIdeas.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>

                {clientIdeas.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
                    No hay videos editados en el filtro actual.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                    {clientIdeas.map((idea) => {
                      const hasEdit = ideaTieneEditadoEntregas(idea)
                      const caption = captionOf(idea, captionOverrides)
                      const approved = idea.staff_client_approval === 'approved' || idea.client_review_status === 'approved'
                      return (
                        <li
                          key={idea.id}
                          data-testid={`recibo-idea-${idea.id}`}
                          className="flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-card/80 shadow-md shadow-black/20"
                        >
                          <div className="relative bg-zinc-950 px-3 pb-2 pt-3 sm:px-4">
                            <div className="mx-auto w-full max-w-[min(100%,280px)]">
                              <ReciboVideoPreview ideaId={idea.id} hasEdited={hasEdit} expectedVideoId={editedEntregasVideoId(idea) ?? undefined} />
                            </div>
                            <ReciboStatusMarks
                              ideaId={idea.id}
                              clientId={idea.client_id}
                              approved={approved}
                              sent={sent.has(idea.id)}
                            />
                            {client.ai && <ReciboDeleteButton ideaId={idea.id} title={ideaTitle(idea)} />}
                          </div>
                          <ReciboCaption ideaId={idea.id} caption={caption} disabled={!hasEdit || filling} />
                          <ReciboPublishButton
                            ideaId={idea.id}
                            approved={approved}
                            todayISO={todayISO ?? ''}
                            cadence={cadenceByClient[idea.client_id] ?? {}}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
