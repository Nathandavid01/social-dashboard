'use client'

import {
  Calendar,
  Check,
  Clapperboard,
  FileVideo,
  Film,
  Hash,
  Image as ImageIcon,
  MessageSquare,
  Pencil,
  Send,
  Upload,
  UploadCloud,
  Video as VideoIcon,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'
import {
  cardStatus,
  contentTypeLabel,
  isRecorded,
  slotStatus,
  type BatchVideo,
  type SlotTone,
} from '@/lib/utils/batch-view'

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
}: {
  video: BatchVideo | null
  assigneeName?: string | null
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
  const raw = slotStatus(video.videos.raw.length)
  const broll = slotStatus(video.videos.broll.length, true)
  const edited = slotStatus(video.videos.edited.length)

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
        <div className="flex h-[240px] flex-col items-center justify-center gap-2.5 border-b border-dashed border-border bg-muted/40 px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UploadCloud className="h-6 w-6 text-primary" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-foreground">Sube la grabación de este video</p>
          <p className="text-xs text-muted-foreground">
            Arrastra el archivo aquí o haz clic para buscarlo
          </p>
          <Button size="sm" className="mt-1 gap-1.5">
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Subir archivo
          </Button>
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

        {video.hook && (
          <Section icon={<Zap className="h-3 w-3 text-primary" aria-hidden />} title="Gancho">
            <p className="text-[13px] leading-relaxed text-foreground">{video.hook}</p>
          </Section>
        )}
        {video.visual_brief && (
          <Section
            icon={<ImageIcon className="h-3 w-3 text-violet-500" aria-hidden />}
            title="Idea visual"
          >
            <p className="text-[13px] leading-relaxed text-muted-foreground">{video.visual_brief}</p>
          </Section>
        )}
        {video.caption_angle && (
          <Section
            icon={<MessageSquare className="h-3 w-3 text-cyan-500" aria-hidden />}
            title="Caption / ángulo"
          >
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {video.caption_angle}
            </p>
          </Section>
        )}
        {hashtags.length > 0 && (
          <Section icon={<Hash className="h-3 w-3 text-emerald-500" aria-hidden />} title="Hashtags">
            <div className="flex flex-wrap gap-1.5">
              {hashtags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
              {hashtags.length > 6 && (
                <span className="px-2.5 py-1 text-[11px] text-muted-foreground/70">
                  +{hashtags.length - 6} más
                </span>
              )}
            </div>
          </Section>
        )}

        {/* files */}
        <Section icon={<Film className="h-3 w-3 text-amber-500" aria-hidden />} title="Archivos">
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-muted/30">
            {[
              { icon: <VideoIcon className="h-3 w-3" aria-hidden />, label: 'Video sin editar (raw)', slot: raw },
              { icon: <Film className="h-3 w-3" aria-hidden />, label: 'B-roll', slot: broll },
              { icon: <Clapperboard className="h-3 w-3" aria-hidden />, label: 'Versión editada', slot: edited },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {row.icon}
                  </span>
                  <span className="text-[13px] font-medium text-foreground">{row.label}</span>
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    SLOT_TONE[row.slot.tone],
                  )}
                >
                  {row.slot.label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* actions */}
        <div className="flex gap-2.5">
          <Button className="flex-1 gap-1.5">
            <Check className="h-4 w-4" aria-hidden />
            {recorded ? 'Marcado como grabado' : 'Marcar como grabado'}
          </Button>
          <Button variant="secondary" className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Editar
          </Button>
        </div>
      </div>
    </div>
  )
}
