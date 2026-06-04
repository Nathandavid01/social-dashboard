'use client'

import { Check, Play, Upload, Video as VideoIcon, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStatus, contentTypeLabel, isRecorded, type BatchVideo } from '@/lib/utils/batch-view'

/** Soft brand gradients cycled across recorded cards, matching the design. */
export const CARD_GRADIENTS = [
  'from-violet-500 to-blue-500',
  'from-cyan-500 to-emerald-500',
  'from-emerald-500 to-amber-500',
  'from-rose-500 to-violet-500',
  'from-amber-500 to-rose-500',
  'from-blue-500 to-cyan-500',
]

interface Props {
  video: BatchVideo
  /** Index used to pick a stable gradient for recorded cards. */
  accentIndex: number
  selected: boolean
  durationLabel?: string | null
  onSelect: (id: string) => void
}

export function BatchVideoCard({ video, accentIndex, selected, durationLabel, onSelect }: Props) {
  const recorded = isRecorded(video)
  const status = cardStatus(video)
  const gradient = CARD_GRADIENTS[accentIndex % CARD_GRADIENTS.length]
  const isCarousel = video.content_type === 'C'

  return (
    <button
      type="button"
      onClick={() => onSelect(video.id)}
      aria-pressed={selected}
      className={cn(
        'group flex w-full flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border/80',
      )}
    >
      {/* thumbnail / upload placeholder */}
      {recorded ? (
        <div
          className={cn(
            'relative flex h-[150px] items-center justify-center bg-gradient-to-br',
            gradient,
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
            <Play className="h-[18px] w-[18px] text-foreground" aria-hidden />
          </span>
          {durationLabel && (
            <span className="absolute bottom-2 right-2 rounded bg-background/70 px-1.5 py-0.5 text-[11px] tabular-nums text-foreground/90">
              {durationLabel}
            </span>
          )}
        </div>
      ) : (
        <div className="flex h-[150px] flex-col items-center justify-center gap-2 border-b border-dashed border-border bg-muted/40">
          <Upload className="h-[22px] w-[22px] text-muted-foreground" aria-hidden />
          <span className="text-xs font-medium text-muted-foreground">Subir grabación</span>
        </div>
      )}

      {/* body */}
      <div className="flex flex-col gap-2.5 p-3">
        <div className="flex items-center justify-between">
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
          {selected && (
            <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
              Abierto
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {video.title}
        </h3>
        {video.hook && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{video.hook}</p>
        )}

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {isCarousel ? (
              <LayoutGrid className="h-3 w-3 text-muted-foreground/70" aria-hidden />
            ) : (
              <VideoIcon className="h-3 w-3 text-muted-foreground/70" aria-hidden />
            )}
            {contentTypeLabel(video.content_type)}
          </span>
        </div>
      </div>
    </button>
  )
}
