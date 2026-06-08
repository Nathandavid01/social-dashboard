'use client'

import { Check, Film, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStatus, contentTypeLabel, isRecorded, type BatchVideo } from '@/lib/utils/batch-view'
import { deadlineStatus, deadlineTone } from '@/lib/utils/deadlines'
import { userAccent } from '@/lib/utils/user-accent'

const MES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** "8 jun" from a date-only "YYYY-MM-DD" (no TZ shift). */
function fmtDeadline(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MES_ES[(m ?? 1) - 1]}`
}
import { InlineEdit } from '@/components/shared/inline-edit'
import { updateIdeaTitle } from '@/lib/actions/content-ideas'
import { IdeaBriefCard } from '@/components/produccion/idea-brief-card'
import { IdeaCaptionEditor } from '@/components/produccion/idea-caption-editor'
import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'
import { ApprovalButton } from '@/components/produccion/approval-button'
import { useAuth } from '@/lib/context/auth-context'

/**
 * A full work card for one video of the batch: its idea and caption are editable
 * inline (no separate panel), plus the raw/b-roll/edited uploads. This is where
 * the team writes the idea and the caption for each planned video.
 *
 * Once an edited video is uploaded (or the approval flow has started) the card
 * shows the approval control — approving here auto-publishes to Metricool, just
 * like the Video QC table. Each card also shows who it's assigned to.
 */
export function VideoWorkCard({
  video,
  index,
  clientName,
  clientLogoUrl,
}: {
  video: BatchVideo
  index: number
  clientName?: string | null
  clientLogoUrl?: string | null
}) {
  const { user } = useAuth()
  const recorded = isRecorded(video)
  const status = cardStatus(video)
  const ideaVideos = [...video.videos.raw, ...video.videos.broll, ...video.videos.edited]

  // The approval control appears once there's an edited cut to review, or once
  // the approval flow has already moved past "pending" (so its state stays visible).
  const showApproval = video.videos.edited.length > 0 || video.approval_status !== 'pending'

  const assignee = video.assignee ?? null
  const mine = !!assignee && !!user && assignee.id === user.id
  const accent = userAccent(assignee?.id)

  const dl = deadlineStatus(video.deadline, video.status)
  const dlTone = deadlineTone(dl)

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
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
          {video.deadline && (
            <span
              className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap', dlTone.className)}
              title={`Fecha límite: ${fmtDeadline(video.deadline)}`}
            >
              <Flag className="h-3 w-3" aria-hidden />
              {dlTone.label ? `${dlTone.label} · ` : ''}{fmtDeadline(video.deadline)}
            </span>
          )}
          {assignee ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: accent.soft, color: accent.text }}
              title={assignee.full_name ?? 'Asignado'}
            >
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-bold text-black" style={{ backgroundColor: accent.dot }}>
                {(assignee.full_name ?? '?').slice(0, 1).toUpperCase()}
              </span>
              {mine ? 'Asignado a ti' : assignee.full_name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Sin asignar
            </span>
          )}
        </div>
      </header>

      {/* idea — editable inline (gancho, brief, ángulo, hashtags, fecha) */}
      <IdeaBriefCard
        ideaId={video.id}
        hook={video.hook}
        visualBrief={video.visual_brief}
        captionAngle={video.caption_angle}
        hashtags={video.hashtags_suggestion}
        publishDate={video.publish_date}
        deadline={video.deadline}
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

      {/* aprobación — visible once hay un video editado para revisar.
          Aprobar aquí dispara la auto-publicación a Metricool. */}
      {showApproval && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Aprobación
          </span>
          <ApprovalButton
            ideaId={video.id}
            approvalStatus={video.approval_status}
            clientName={clientName}
            clientLogoUrl={clientLogoUrl}
            ideaTitle={video.title}
          />
        </div>
      )}
    </section>
  )
}
