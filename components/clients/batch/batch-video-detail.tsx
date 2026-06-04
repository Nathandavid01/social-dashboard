'use client'

import {
  Calendar,
  Check,
  FileVideo,
  Film,
  Hash,
  Image as ImageIcon,
  MessageSquare,
  Send,
  UploadCloud,
  Video as VideoIcon,
  Zap,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { cardStatus, contentTypeLabel, isRecorded, type BatchVideo, type SlotTone } from '@/lib/utils/batch-view'
import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'
import { IdeaBriefCard } from '@/components/produccion/idea-brief-card'
import { IdeaCaptionEditor } from '@/components/produccion/idea-caption-editor'

const SLOT_TONE: Record<SlotTone, string> = {
  ready: 'bg-emerald-500/10 text-emerald-500',
  pending: 'bg-amber-500/10 text-amber-500',
  muted: 'bg-muted text-muted-foreground',
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function parseHashtags(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
}

export function BatchVideoDetail({
  video,
  assigneeName,
  onChanged,
}: {
  video: BatchVideo | null
  assigneeName?: string | null
  /** Called after an upload so the parent can refetch. */
  onChanged?: () => void
}) {
  if (!video) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-8 text-center">
        <FileVideo className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Selecciona un video de la lista para ver su detalle.
        </p>
      </div>
    )
  }

  const recorded = isRecorded(video)
  const status = cardStatus(video)
  const hashtags = parseHashtags(video.hashtags_suggestion)
  const ideaVideos = [...video.videos.raw, ...video.videos.broll, ...video.videos.edited]
  void onChanged

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileVideo className="h-[15px] w-[15px] text-primary" aria-hidden />
          <span className="text-sm font-semibold text-foreground">Detalle del video</span>
        </div>
      </div>

      {/* preview / dropzone */}
      {recorded ? (
        <div className="flex h-[200px] items-center justify-center bg-gradient-to-br from-violet-500 to-blue-500">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
            <VideoIcon className="h-5 w-5 text-foreground" aria-hidden />
          </span>
        </div>
      ) : (
        <div className="flex h-[160px] flex-col items-center justify-center gap-2.5 border-b border-dashed border-border bg-muted/40 px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UploadCloud className="h-6 w-6 text-primary" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-foreground">Aún sin grabación</p>
          <p className="text-xs text-muted-foreground">
            Sube el archivo en la sección «Archivos» de abajo.
          </p>
        </div>
      )}

      {/* content */}
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {video.content_type === 'C' ? (
              <ImageIcon className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <VideoIcon className="h-2.5 w-2.5" aria-hidden />
            )}
            {contentTypeLabel(video.content_type)}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
              recorded ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500',
            )}
          >
            {recorded ? (
              <Check className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            )}
            {status.label}
          </span>
        </div>

        <h2 className="text-lg font-bold leading-tight text-foreground">{video.title}</h2>

        {/* meta grid */}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3.5">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Grabación
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <Calendar className="h-3 w-3 text-amber-500" aria-hidden />
              {video.recording_date ? formatDate(video.recording_date) : 'Sin fecha'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Publicación
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <Send className="h-3 w-3 text-muted-foreground" aria-hidden />
              {video.publish_date ? formatDate(video.publish_date) : 'Sin fecha'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Aprobación
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  video.approval_status === 'approved' ? 'bg-emerald-500' : 'bg-amber-500',
                )}
                aria-hidden
              />
              {video.approval_status === 'approved'
                ? 'Aprobado'
                : video.approval_status === 'submitted'
                  ? 'Enviado al cliente'
                  : 'Pendiente del cliente'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Encargado
            </span>
            <span className="text-[13px] font-medium text-foreground">
              {assigneeName ?? 'Sin asignar'}
            </span>
          </div>
        </div>

        {/* idea — editable (hook, brief, caption angle, hashtags, publish date) */}
        <IdeaBriefCard
          ideaId={video.id}
          hook={video.hook}
          visualBrief={video.visual_brief}
          captionAngle={video.caption_angle}
          hashtags={video.hashtags_suggestion}
          publishDate={video.publish_date}
        />

        {/* caption — editable, with AI generate */}
        <IdeaCaptionEditor
          ideaId={video.id}
          initialCaption={video.generated_caption}
          initialPlatform={video.caption_platform}
        />

        {/* files — raw / b-roll / edited uploads to R2 */}
        <Section icon={<Film className="h-3 w-3 text-amber-500" aria-hidden />} title="Archivos">
          <IdeaVideoPanel ideaId={video.id} videos={ideaVideos} />
        </Section>
      </div>
    </div>
  )
}
