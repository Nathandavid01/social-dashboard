'use client'

import { Check, Film } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStatus, contentTypeLabel, isRecorded, type BatchVideo } from '@/lib/utils/batch-view'
import { IdeaBriefCard } from '@/components/produccion/idea-brief-card'
import { IdeaCaptionEditor } from '@/components/produccion/idea-caption-editor'
import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'

/**
 * A full work card for one video of the batch: its idea and caption are editable
 * inline (no separate panel), plus the raw/b-roll/edited uploads. This is where
 * the team writes the idea and the caption for each planned video.
 */
export function VideoWorkCard({ video, index }: { video: BatchVideo; index: number }) {
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
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Video {index + 1}</span>
            <span className="text-[11px] text-muted-foreground">{contentTypeLabel(video.content_type)}</span>
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
        initialPlatform={video.caption_platform}
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
    </section>
  )
}
