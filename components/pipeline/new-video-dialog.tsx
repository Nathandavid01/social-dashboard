'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { platformLabels } from '@/lib/utils'
import { createContentIdeaManual } from '@/lib/actions/content-ideas'
import { PLATFORM_FORMATS, defaultFormatFor, defaultPlatformFormats } from '@/lib/utils/platform-formats'
import {
  emptyClientPipelineSummary,
  type ClientCadence,
  type ClientPipelineSummary,
} from '@/lib/utils/content-batches'
import type { ContentIdeaType, SocialPlatform } from '@/lib/supabase/types'

const TYPES: { value: ContentIdeaType; label: string }[] = [
  { value: 'R', label: 'Reel' },
  { value: 'P', label: 'Post' },
  { value: 'C', label: 'Carrusel' },
  { value: 'S', label: 'Story' },
]

const NETWORKS: SocialPlatform[] = ['instagram', 'tiktok', 'facebook', 'linkedin']

const MAX_LISTED_VIDEOS = 5

function ClientPipelineStatus({ summary }: { summary: ClientPipelineSummary | undefined }) {
  if (!summary) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Este cliente no tiene videos en el pipeline.
      </p>
    )
  }

  if (summary.total === 0 && !summary.nextNewVideo) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Este cliente no tiene videos en el pipeline.
        {!summary.hasMetricool && (
          <span className="mt-1 block">Metricool no está configurado para este cliente.</span>
        )}
      </p>
    )
  }

  const shown = summary.videos.slice(0, MAX_LISTED_VIDEOS)
  const rest = summary.videos.length - shown.length

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 px-3 py-2.5" aria-live="polite">
      {summary.total > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          <span className="font-medium text-foreground">
            {summary.total} video{summary.total === 1 ? '' : 's'} en el batch
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground">
            Etapa actual: <span className="font-semibold">{summary.batchStageLabel}</span>
          </span>
          {summary.published > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-emerald-500">
                {summary.published} publicado{summary.published === 1 ? '' : 's'}
              </span>
            </>
          )}
        </div>
      )}

      {summary.metricoolScheduled > 0 && (
        <p className="text-xs text-sky-400">
          {summary.metricoolScheduled} video{summary.metricoolScheduled === 1 ? '' : 's'} programado
          {summary.metricoolScheduled === 1 ? '' : 's'} en Metricool
          {summary.hasMetricool ? '' : ' (revisa blog_id del cliente)'}
        </p>
      )}

      {summary.nextPublish && (
        <p className="text-xs text-foreground">
          <span className="text-muted-foreground">Próxima publicación: </span>
          {summary.nextPublish.title ? (
            <span className="font-medium">{summary.nextPublish.title}</span>
          ) : null}
          {summary.nextPublish.title ? ' · ' : ''}
          <span>{summary.nextPublish.whenLabel}</span>
          {summary.nextPublish.inMetricool && (
            <span className="ml-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
              Metricool
            </span>
          )}
        </p>
      )}

      {summary.nextNewVideo && (
        <p className="text-xs text-amber-400/90">
          <span className="text-muted-foreground">Si creas un video ahora: </span>
          publicación estimada el {summary.nextNewVideo.whenLabel}
          {summary.hasMetricool && (
            <span className="text-muted-foreground"> (auto-publica al aprobar si está listo)</span>
          )}
        </p>
      )}

      {summary.total > 0 && (
        <>
          <ul className="space-y-1">
            {shown.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">
                  {v.title}
                  {v.publishLabel && (
                    <span className="ml-1 text-[10px] text-muted-foreground/70">· {v.publishLabel}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {v.inMetricool && (
                    <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-400">
                      Metricool
                    </span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                    {v.stageLabel}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {rest > 0 && <p className="text-[10px] text-muted-foreground">y {rest} más…</p>}
        </>
      )}
    </div>
  )
}

/**
 * "Nuevo video" — creates a content_idea (lands in the Title/Idea column).
 *
 * `defaultClientId` pre-selects a client (used when opened from a client's batch
 * view). `onCreated` runs after a successful create — pass it so an in-place
 * overlay can refetch instead of relying on router.refresh(). `children`, when
 * given, replaces the default gold trigger button (so callers can style it).
 */
export function NewVideoDialog({
  clients,
  defaultClientId = '',
  pipelineByClient = {},
  clientCadence = {},
  onCreated,
  children,
}: {
  clients: { id: string; name: string }[]
  defaultClientId?: string
  /** Active videos per client — powers the pipeline status panel below the picker. */
  pipelineByClient?: Record<string, ClientPipelineSummary>
  clientCadence?: Record<string, ClientCadence>
  onCreated?: () => void
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState(defaultClientId)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ContentIdeaType>('R')
  // Per-network format: a network present in the map = selected for this video.
  const [formats, setFormats] = useState<Record<string, string>>(() =>
    defaultPlatformFormats(['instagram', 'tiktok', 'facebook']),
  )
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const selectedPipeline = useMemo(() => {
    if (!clientId) return undefined
    if (pipelineByClient[clientId]) return pipelineByClient[clientId]
    return emptyClientPipelineSummary(clientCadence[clientId] ?? {}) ?? undefined
  }, [clientId, pipelineByClient, clientCadence])

  function toggleNetwork(p: SocialPlatform, on: boolean) {
    setFormats((f) => {
      const next = { ...f }
      if (on) next[p] = next[p] ?? defaultFormatFor(p)
      else delete next[p]
      return next
    })
  }

  const canCreate = !!clientId && title.trim().length > 0 && !pending

  async function create() {
    if (!canCreate) return
    setPending(true)
    const res = await createContentIdeaManual({ clientId, contentType: type, title: title.trim(), platformFormats: formats })
    setPending(false)
    if ('error' in res && res.error) {
      toast({ title: 'No se pudo crear', description: res.error, variant: 'destructive' })
      return
    }
    setOpen(false)
    setTitle('')
    setClientId(defaultClientId)
    if (onCreated) onCreated()
    else router.refresh()
  }

  return (
    <>
      {children ? (
        <span onClick={() => setOpen(true)} className="contents">
          {children}
        </span>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-black transition hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo video
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo video</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={clientId || undefined} onValueChange={setClientId}>
              <SelectTrigger aria-label="Cliente">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {clients.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay clientes activos</p>
                ) : (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {clientId ? <ClientPipelineStatus summary={selectedPipeline} /> : null}
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del video" />
            <Select value={type} onValueChange={(v) => setType(v as ContentIdeaType)}>
              <SelectTrigger aria-label="Tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Formato por red — un mismo caption va a todas, el formato puede variar */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Formato por red</p>
              <div className="divide-y divide-border rounded-md border border-border">
                {NETWORKS.map((p) => {
                  const on = p in formats
                  return (
                    <div key={p} className="flex items-center justify-between gap-2 px-3 py-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => toggleNetwork(p, e.target.checked)}
                          aria-label={platformLabels[p]}
                        />
                        {platformLabels[p]}
                      </label>
                      {on ? (
                        <select
                          value={formats[p]}
                          onChange={(e) => setFormats((f) => ({ ...f, [p]: e.target.value }))}
                          aria-label={`Formato ${platformLabels[p]}`}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          {PLATFORM_FORMATS[p].map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={!canCreate}>{pending ? 'Creando…' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
