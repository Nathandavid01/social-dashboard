'use client'

import type { VideoReview } from '@/lib/supabase/types'
import { VIDEO_ERROR_TYPES } from '@/lib/supabase/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, RotateCcw, User, Eye, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

const STAGE_CHIP: Partial<Record<VideoReview['status'], { label: string; icon: typeof Eye; className: string }>> = {
  head_editor_review: {
    label: 'Editor Review',
    icon: Eye,
    className: 'border-yellow-300 text-yellow-700 bg-yellow-50',
  },
  final_check_review: {
    label: 'Final Check',
    icon: Search,
    className: 'border-purple-300 text-purple-700 bg-purple-50',
  },
  pending_final_check: {
    label: 'Esperando Final',
    icon: Search,
    className: 'border-cyan-300 text-cyan-700 bg-cyan-50',
  },
}

interface VideoReviewCardProps {
  review: VideoReview
  onClick: () => void
}

const errorLabelMap = Object.fromEntries(
  VIDEO_ERROR_TYPES.map((e) => [e.slug, e.label])
)

export function VideoReviewCard({ review, onClick }: VideoReviewCardProps) {
  const editorName = review.editor
    ? (review.editor as { full_name: string }).full_name
    : null
  const clientName = review.client
    ? (review.client as { name: string }).name
    : null
  const timeAgo = formatDistanceToNow(new Date(review.created_at), { addSuffix: true })
  const hasErrors = review.errors.length > 0
  const stageChip = STAGE_CHIP[review.status]

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all group/card border-border"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Title + Drive link */}
        <div className="flex items-start gap-2">
          <p className="text-sm font-semibold leading-snug flex-1">{review.title}</p>
          <a
            href={review.drive_link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover/card:opacity-100"
            title="Open in Drive"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Stage chip */}
        {stageChip && (
          <Badge variant="outline" className={cn('text-[10px] gap-1 w-fit', stageChip.className)}>
            <stageChip.icon className="h-3 w-3" />
            {stageChip.label}
          </Badge>
        )}

        {/* Client + editor */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {clientName && <span className="font-medium text-foreground">@ {clientName}</span>}
          {editorName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {editorName}
            </span>
          )}
          <span className="ml-auto">{timeAgo}</span>
        </div>

        {/* Error badges */}
        {hasErrors && (
          <div className="flex flex-wrap gap-1">
            {review.errors.slice(0, 4).map((slug) => (
              <Badge
                key={slug}
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-red-300 text-red-600 bg-red-50"
              >
                {errorLabelMap[slug] ?? slug}
              </Badge>
            ))}
            {review.errors.length > 4 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{review.errors.length - 4} more
              </Badge>
            )}
          </div>
        )}

        {/* Revision count */}
        {review.revision_count > 0 && (
          <div className={cn('flex items-center gap-1 text-xs', hasErrors ? 'text-red-500' : 'text-muted-foreground')}>
            <RotateCcw className="h-3 w-3" />
            <span>{review.revision_count} revision{review.revision_count !== 1 ? 's' : ''}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
