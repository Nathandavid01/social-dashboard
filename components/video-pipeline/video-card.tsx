'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Film, ImageIcon, LayoutGrid, Circle, Camera, Video, Clapperboard,
  Download, ExternalLink, Calendar, CalendarCheck, MessageSquare, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { getR2DownloadUrl } from '@/lib/actions/idea-videos-r2'
import { ApprovalButton } from '@/components/produccion/approval-button'
import { computeIdeaProgress } from '@/lib/utils/idea-progress'
import { ClientLogo } from '@/components/clients/client-logo'
import type {
  ContentIdeaType,
  ContentIdeaStatus,
  IdeaApprovalStatus,
  ContentIdeaVideo,
  ContentIdeaVideoKind,
} from '@/lib/supabase/types'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

const TYPE_CONFIG: Record<ContentIdeaType, { label: string; icon: typeof Film; color: string }> = {
  R: { label: 'Reel',     icon: Film,      color: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-900/50' },
  P: { label: 'Post',     icon: ImageIcon, color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50' },
  C: { label: 'Carrusel', icon: LayoutGrid,color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-900/50' },
  S: { label: 'Story',    icon: Circle,    color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50' },
}

const STATUS_CONFIG: Record<ContentIdeaStatus, { label: string; color: string }> = {
  idea:       { label: 'Idea',          color: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' },
  asignada:   { label: 'Asignada',      color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-900/50' },
  grabada:    { label: 'Grabada',       color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50' },
  producida:  { label: 'En producción', color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50' },
  publicada:  { label: 'Publicada',     color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900/50' },
  descartada: { label: 'Descartada',    color: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700' },
}

const APPROVAL_CONFIG: Record<IdeaApprovalStatus, { label: string; color: string }> = {
  pending:         { label: 'Sin enviar',     color: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' },
  submitted:       { label: 'En revisión',    color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50' },
  approved:        { label: 'Aprobado',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-900/50' },
  revision_needed: { label: 'Cambios pedidos',color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-900/50' },
}

const SLOT_META: Record<ContentIdeaVideoKind, { label: string; min: number; icon: typeof Camera; tone: string }> = {
  raw:    { label: 'Crudos',  min: 4, icon: Camera,       tone: 'text-cyan-500' },
  broll:  { label: 'B-roll',  min: 4, icon: Video,        tone: 'text-teal-500' },
  edited: { label: 'Editados',min: 2, icon: Clapperboard, tone: 'text-purple-500' },
}

const SLOT_ORDER: ContentIdeaVideoKind[] = ['raw', 'broll', 'edited']

// Active (non-archived, non-failed) videos count toward the slot fill.
function activeVideos(videos: ContentIdeaVideo[]): ContentIdeaVideo[] {
  return videos.filter((v) => v.status === 'uploaded' || v.status === 'uploading' || v.status === 'processing')
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  // Date-only columns ("2026-05-28") parse as UTC midnight; render the calendar day.
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-PR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Stops a nested interactive element from triggering the card-wide <Link>. */
function stop(e: React.MouseEvent) {
  e.stopPropagation()
}

export function VideoCard({
  video,
  assetCount = 0,
  clientName,
  clientLogoUrl,
}: {
  video: PipelineVideo
  assetCount?: number
  clientName?: string | null
  clientLogoUrl?: string | null
}) {
  const { toast } = useToast()
  const typeCfg = TYPE_CONFIG[video.content_type] ?? TYPE_CONFIG.R
  const statusCfg = STATUS_CONFIG[video.status] ?? STATUS_CONFIG.idea
  const approvalCfg = APPROVAL_CONFIG[video.approval_status] ?? APPROVAL_CONFIG.pending
  const TypeIcon = typeCfg.icon

  const brief = video.hook?.trim() || video.visual_brief?.trim() || null
  const caption = video.generated_caption?.trim() || null
  const recordingDate = formatDate(video.recording_date)
  const publishDate = formatDate(video.publish_date)

  const progress = computeIdeaProgress({
    idea: video,
    videos: [...video.videos.raw, ...video.videos.broll, ...video.videos.edited],
    assetCount,
  })

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
        'focus-within:border-primary/40',
        'animate-in fade-in slide-in-from-bottom-1 duration-300',
        video.status === 'descartada' && 'opacity-60',
      )}
    >
      {/* Card-wide navigation overlay. Sits behind interactive children (z-10) so
          chips/buttons stay clickable and we avoid nesting <a>/<button> inside <a>. */}
      <Link
        href={`/produccion/idea/${video.id}`}
        aria-label={video.title || 'Sin título'}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      {/* Header: title + badges */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {(clientLogoUrl || clientName) && (
            <ClientLogo name={clientName} logoUrl={clientLogoUrl} className="h-6 w-6 text-[9px]" />
          )}
          <p className="truncate text-sm font-semibold leading-snug group-hover:text-primary">
            {video.title || 'Sin título'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Badge variant="outline" className={cn('gap-1 whitespace-nowrap text-[10px]', typeCfg.color)}>
            <TypeIcon className="h-3 w-3" />
            {typeCfg.label}
          </Badge>
          <Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', statusCfg.color)}>
            {statusCfg.label}
          </Badge>
          <Badge variant="outline" className={cn('whitespace-nowrap text-[10px]', approvalCfg.color)}>
            {approvalCfg.label}
          </Badge>
        </div>
      </div>

      {/* Stage progress chips */}
      <div className="relative z-10 flex flex-wrap gap-1">
        {progress.stages.map((s) => (
          <span
            key={s.key}
            className={cn(
              'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium',
              s.done
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {s.label}
            {s.count ? ` ${s.count.current}/${s.count.total}` : s.done ? ' ✓' : ''}
          </span>
        ))}
      </div>

      {/* Brief / hook */}
      {brief ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{brief}</p>
      ) : (
        <p className="text-xs italic text-muted-foreground/60">Sin brief ni hook</p>
      )}

      {/* Caption preview */}
      {caption ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="h-3 w-3" /> Caption
            {video.caption_platform && (
              <span className="rounded bg-background px-1.5 py-0.5 font-normal normal-case text-muted-foreground/80">
                {video.caption_platform}
              </span>
            )}
          </p>
          <p className="line-clamp-2 whitespace-pre-line text-xs text-foreground/80">{caption}</p>
        </div>
      ) : (
        <p className="text-[11px] italic text-muted-foreground/60">Sin caption generado</p>
      )}

      {/* Slot summary */}
      <div className="space-y-1.5">
        {SLOT_ORDER.map((kind) => {
          const meta = SLOT_META[kind]
          const active = activeVideos(video.videos[kind])
          const Icon = meta.icon
          const reached = active.length >= meta.min
          return (
            <div key={kind} className="flex items-center gap-2">
              <span className="flex w-24 shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Icon className={cn('h-3.5 w-3.5', meta.tone)} /> {meta.label}
              </span>
              <span
                className={cn(
                  'tabular-nums text-[11px] font-semibold',
                  reached ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/70',
                )}
              >
                {active.length}/{meta.min}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                {active.length === 0 ? (
                  <span className="text-[10px] italic text-muted-foreground/50">vacío</span>
                ) : (
                  active.slice(0, 4).map((v) => (
                    <SlotChip
                      key={v.id}
                      video={v}
                      onError={(m) => toast({ title: 'Error', description: m, variant: 'destructive' })}
                    />
                  ))
                )}
                {active.length > 4 && (
                  <span className="text-[10px] text-muted-foreground/70">+{active.length - 4}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dates */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" /> Grabación: {recordingDate ?? '—'}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarCheck className="h-3.5 w-3.5" /> Publicación: {publishDate ?? '—'}
        </span>
      </div>

      {/* Approval button — sits above the navigation overlay so it never navigates. */}
      <div onClick={stop} className="relative z-10 pt-1">
        <ApprovalButton
          ideaId={video.id}
          approvalStatus={video.approval_status}
          clientName={clientName}
          clientLogoUrl={clientLogoUrl}
          ideaTitle={video.title}
        />
      </div>
    </div>
  )
}

/** A small downloadable/openable chip for one uploaded video. */
function SlotChip({ video, onError }: { video: ContentIdeaVideo; onError: (msg: string) => void }) {
  const [pending, setPending] = useState(false)
  const isR2 = video.storage_provider === 'r2'
  const label = video.name || video.kind

  async function download(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setPending(true)
    try {
      const res = await getR2DownloadUrl(video.id)
      if (res.error || !res.url) onError(res.error ?? 'No se pudo generar el enlace de descarga')
      else window.open(res.url, '_blank')
    } finally {
      setPending(false)
    }
  }

  const baseCls =
    'relative z-10 inline-flex max-w-[7.5rem] items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[10px] transition-colors hover:border-primary/40 hover:text-primary'

  // R2 needs a presigned URL fetched on click; Drive has a direct view link.
  if (isR2) {
    return (
      <button type="button" onClick={download} disabled={pending} className={baseCls} title={`Descargar ${label}`}>
        {pending ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <Download className="h-3 w-3 shrink-0" />}
        <span className="truncate">{label}</span>
      </button>
    )
  }

  if (video.drive_view_link) {
    return (
      <a
        href={video.drive_view_link}
        target="_blank"
        rel="noreferrer"
        onClick={stop}
        className={baseCls}
        title={`Abrir ${label} en Drive`}
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
      </a>
    )
  }

  // No download target available — show the name as a static chip.
  return (
    <span
      className="inline-flex max-w-[7.5rem] items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
      title={label}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}
