'use client'

import { Check, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStatus, contentTypeLabel, isRecorded, type BatchVideo } from '@/lib/utils/batch-view'
import { InlineEdit } from '@/components/shared/inline-edit'
import { updateIdeaTitle } from '@/lib/actions/content-ideas'
import { IdeaBriefCard } from '@/components/produccion/idea-brief-card'
import { IdeaCaptionEditor } from '@/components/produccion/idea-caption-editor'
import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'
import { ApprovalButton } from '@/components/produccion/approval-button'
import type { SocialPlatform } from '@/lib/supabase/types'

/**
 * A full work card for one video of the batch: its idea and caption are editable
 * inline (no separate panel), plus the raw/b-roll/edited uploads. This is where
 * the team writes the idea and the caption for each planned video — and, once the
 * edited video is ready, sends it to the client for approval.
 */
export function VideoWorkCard({
  video,
  index,
  platforms,
  clientName,
  clientLogoUrl,
}: {
  video: BatchVideo
  index: number
  platforms?: SocialPlatform[]
  clientName?: string | null
  clientLogoUrl?: string | null
}) {
  const recorded = isRecorded(video)
  const status = cardStatus(video)
  const ideaVideos = [...video.videos.raw, ...video.videos.broll, ...video.videos.edited]

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col">
            <InlineEdit
              value={video.title}
              onSave={(v) => updateIdeaTitle(video.id, v)}
              placeholder={`Video ${index + 1}`}
              displayClassName="text-sm font-semibold text-foreground"
            />
            <span className="text-[11px] text-muted-foreground">
              Video {index + 1} · {contentTypeLabel(video.content_type)}
            </span>
          </div>
        </div>
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
      </header>

      {/* idea — editable inline (gancho, brief, ángulo, hashtags, fecha) */}
      <IdeaBriefCard
        ideaId={video.id}
        hook={video.hook}
        visualBrief={video.visual_brief}
        captionAngle={video.caption_angle}
        hashtags={video.hashtags_suggestion}
        publishDate={video.publish_date}
      />

      {/* caption — editable inline + AI */}
      <IdeaCaptionEditor
        ideaId={video.id}
        initialCaption={video.generated_caption}
        platforms={platforms}
      />

      {/* grabación — raw / b-roll / edited uploads to R2 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Film className="h-3 w-3 text-amber-500" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Grabación
          </span>
        </div>
        <IdeaVideoPanel ideaId={video.id} videos={ideaVideos} />
      </div>

      {/* aprobación — enviar a revisión / aprobar / pedir cambios según el estado */}
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          Cuando el video editado esté listo, envíalo a revisión o apruébalo para publicar.
        </span>
        <ApprovalButton
          ideaId={video.id}
          approvalStatus={video.approval_status}
          clientName={clientName}
          clientLogoUrl={clientLogoUrl}
          ideaTitle={video.title}
        />
      </footer>
    </section>
  )
}
