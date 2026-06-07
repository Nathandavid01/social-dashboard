'use client'

import Link from 'next/link'
import {
  Film, ImageIcon, LayoutGrid, Circle, Camera, Video, Clapperboard, Calendar, CalendarCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ApprovalButton } from '@/components/produccion/approval-button'
import { PublishToMetricoolButton } from '@/components/produccion/publish-metricool-button'
import { computeIdeaProgress } from '@/lib/utils/idea-progress'
import type {
  ContentIdeaType, ContentIdeaStatus, IdeaApprovalStatus, ContentIdeaVideo,
} from '@/lib/supabase/types'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

const TYPE_CFG: Record<ContentIdeaType, { label: string; icon: typeof Film; color: string }> = {
  R: { label: 'Reel', icon: Film, color: 'text-pink-600' },
  P: { label: 'Post', icon: ImageIcon, color: 'text-blue-600' },
  C: { label: 'Carrusel', icon: LayoutGrid, color: 'text-purple-600' },
  S: { label: 'Story', icon: Circle, color: 'text-amber-600' },
}
const STATUS_CFG: Record<ContentIdeaStatus, { label: string; cls: string }> = {
  idea: { label: 'Idea', cls: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20' },
  asignada: { label: 'Asignada', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  grabada: { label: 'Grabada', cls: 'bg-green-500/10 text-green-600 border-green-500/20' },
  producida: { label: 'En producción', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  publicada: { label: 'Publicada', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  descartada: { label: 'Descartada', cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
}
const APPROVAL_CFG: Record<IdeaApprovalStatus, { label: string; cls: string }> = {
  pending: { label: 'Sin enviar', cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  submitted: { label: 'En revisión', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  approved: { label: 'Aprobado', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  revision_needed: { label: 'Cambios', cls: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
}

const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set<ContentIdeaVideo['status']>([
  'uploading', 'uploaded', 'processing',
])
const activeLen = (vs: ContentIdeaVideo[]) => vs.filter((v) => ACTIVE.has(v.status)).length

function fmt(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-PR', { day: 'numeric', month: 'short' })
}

const pill = 'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap'

export function VideoPipelineRow({
  video,
  assetCount,
  clientName,
  clientLogoUrl,
  accentColor,
}: {
  video: PipelineVideo
  assetCount: number
  clientName?: string | null
  clientLogoUrl?: string | null
  /** Client brand color — a left accent so cross-client rows stand out. */
  accentColor?: string | null
}) {
  const type = TYPE_CFG[video.content_type] ?? TYPE_CFG.R
  const TypeIcon = type.icon
  const status = STATUS_CFG[video.status] ?? STATUS_CFG.idea
  const approval = APPROVAL_CFG[video.approval_status] ?? APPROVAL_CFG.pending
  const caption = video.generated_caption?.trim() || null

  const progress = computeIdeaProgress({
    idea: video,
    videos: [...video.videos.raw, ...video.videos.broll, ...video.videos.edited],
    assetCount,
  })
  const currentIdx = progress.stages.findIndex((s) => !s.done)
  const current = currentIdx === -1 ? null : progress.stages[currentIdx]

  const counts = [
    { key: 'raw', icon: Camera, n: activeLen(video.videos.raw), total: 4 },
    { key: 'broll', icon: Video, n: activeLen(video.videos.broll), total: 4 },
    { key: 'edited', icon: Clapperboard, n: activeLen(video.videos.edited), total: 2 },
  ]

  return (
    <tr className={cn('group transition-colors hover:bg-muted/40', video.status === 'descartada' && 'opacity-60')}>
      {/* VIDEO — Title + Date on top row, status below */}
      <td
        className={cn('max-w-0 py-3 pl-3 pr-3 align-top', accentColor && 'border-l-[3px]')}
        style={accentColor ? { borderLeftColor: accentColor } : undefined}
      >
        <div className="space-y-1.5">
          {/* Top row: Title + Date */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <TypeIcon className={cn('h-4 w-4 shrink-0', type.color)} />
              <Link
                href={`/produccion/idea/${video.id}`}
                className="block truncate text-sm font-semibold hover:text-primary"
              >
                {video.title || 'Sin título'}
              </Link>
            </div>

            {/* Date on the same top row as title */}
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground whitespace-nowrap">
              <span className="inline-flex items-center gap-0.5">
                <Calendar className="h-3 w-3" /> {fmt(video.recording_date)}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <CalendarCheck className="h-3 w-3" /> {fmt(video.publish_date)}
              </span>
            </div>
          </div>

          {/* Status directly under the title line */}
          <div className="flex flex-wrap items-center gap-1">
            <span className={cn(pill, status.cls)}>{status.label}</span>
            <span className={cn(pill, approval.cls)}>{approval.label}</span>
            {caption && (
              <span className="ml-1 truncate text-xs text-muted-foreground">{caption}</span>
            )}
          </div>
        </div>
      </td>

      {/* PROGRESO */}
      <td className="py-2.5 pr-3 align-middle">
        <div className="w-36">
          <div className="flex items-center gap-0.5">
            {progress.stages.map((s, i) => (
              <span
                key={s.key}
                title={s.label}
                data-testid="row-stage-segment"
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  s.done ? 'bg-emerald-500' : i === currentIdx ? 'bg-primary' : 'bg-muted',
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {current ? current.label : 'Completo'} · <span className="tabular-nums">{progress.percent}%</span>
          </p>
        </div>
      </td>

      {/* MATERIAL */}
      <td className="py-2.5 pr-3 align-middle">
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          {counts.map((c) => {
            const Icon = c.icon
            return (
              <span key={c.key} className={cn('inline-flex items-center gap-0.5', c.n >= c.total && 'text-emerald-600')}>
                <Icon className="h-3 w-3" />
                {c.n}/{c.total}
              </span>
            )
          })}
        </div>
      </td>

      {/* ACCIÓN */}
      <td className="py-2.5 pr-3 text-right align-middle">
        <div className="inline-flex items-center gap-2">
          <ApprovalButton
            ideaId={video.id}
            approvalStatus={video.approval_status}
            clientName={clientName}
            clientLogoUrl={clientLogoUrl}
            ideaTitle={video.title}
          />
          {video.approval_status === 'approved' && (
            <PublishToMetricoolButton
              ideaId={video.id}
              metricoolPostId={(video as { metricool_post_id?: number | null }).metricool_post_id ?? null}
            />
          )}
        </div>
      </td>
    </tr>
  )
}
