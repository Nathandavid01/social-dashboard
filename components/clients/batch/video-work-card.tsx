'use client'

import { useEffect, useState } from 'react'
import { Check, Film, Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStatus, contentTypeLabel, isRecorded, videoNextStep, type NextStepTone, type BatchVideo } from '@/lib/utils/batch-view'
import { deadlineStatus, deadlineTone, formatDateShortES } from '@/lib/utils/deadlines'
import { InlineEdit } from '@/components/shared/inline-edit'
import { updateIdeaTitle } from '@/lib/actions/content-ideas'
import { IdeaBriefCard } from '@/components/produccion/idea-brief-card'
import { IdeaCaptionEditor } from '@/components/produccion/idea-caption-editor'
import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'
import { ApprovalButton } from '@/components/produccion/approval-button'
import { PublishToMetricoolButton } from '@/components/produccion/publish-metricool-button'
import { ReviewLinkPanel } from '@/components/review/review-link-panel'
import type { SocialPlatform } from '@/lib/supabase/types'

/** Text + dot color per next-step tone (semantic, not the brand accent). */
const NEXT_STEP_TONE: Record<NextStepTone, string> = {
  done: 'text-emerald-600 dark:text-emerald-400',
  action: 'text-amber-600 dark:text-amber-400',
  waiting: 'text-sky-600 dark:text-sky-400',
  warn: 'text-red-600 dark:text-red-400',
}
const NEXT_STEP_DOT: Record<NextStepTone, string> = {
  done: 'bg-emerald-500',
  action: 'bg-amber-500',
  waiting: 'bg-sky-500',
  warn: 'bg-red-500',
}

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

  // published_at also suppresses the badge (the auto-post path may set it without
  // flipping status to 'publicada').
  const dl = deadlineStatus(video.deadline, video.status, undefined, video.published_at)
  const dlTone = deadlineTone(dl)

  const [hook, setHook] = useState(video.hook ?? '')
  const [visualBrief, setVisualBrief] = useState(video.visual_brief ?? '')
  const [captionAngle, setCaptionAngle] = useState(video.caption_angle ?? '')
  const [hashtags, setHashtags] = useState(video.hashtags_suggestion ?? '')
  const [savedCaption, setSavedCaption] = useState(video.generated_caption ?? '')

  useEffect(() => {
    setHook(video.hook ?? '')
    setVisualBrief(video.visual_brief ?? '')
    setCaptionAngle(video.caption_angle ?? '')
    setHashtags(video.hashtags_suggestion ?? '')
    setSavedCaption(video.generated_caption ?? '')
  }, [video.id, video.hook, video.visual_brief, video.caption_angle, video.hashtags_suggestion, video.generated_caption])

  // "Qué sigue" reacts to the locally-saved caption without waiting for a refetch.
  const nextStep = videoNextStep({ ...video, generated_caption: savedCaption || video.generated_caption })

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
              title={`Fecha límite: ${formatDateShortES(video.deadline)}`}
            >
              <Flag className="h-3 w-3" aria-hidden />
              {dlTone.label ? `${dlTone.label} · ` : ''}{formatDateShortES(video.deadline)}
            </span>
          )}
        </div>
      </header>

      {/* 1) el video — lo primero: súbelo */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Film className="h-3 w-3 text-amber-500" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sube el video
          </span>
        </div>
        <IdeaVideoPanel ideaId={video.id} videos={ideaVideos} />
      </div>

      {/* 2) de qué es → la AI escribe el caption (igual que el generador de ideas) */}
      <IdeaBriefCard
        ideaId={video.id}
        hook={hook}
        visualBrief={visualBrief}
        captionAngle={captionAngle}
        hashtags={hashtags}
        publishDate={video.publish_date}
        deadline={video.deadline}
        onBriefUpdated={(fields) => {
          if ('hook' in fields) setHook(fields.hook ?? '')
          if ('visual_brief' in fields) setVisualBrief(fields.visual_brief ?? '')
          if ('caption_angle' in fields) setCaptionAngle(fields.caption_angle ?? '')
          if ('hashtags_suggestion' in fields) setHashtags(fields.hashtags_suggestion ?? '')
        }}
      />
      <IdeaCaptionEditor
        ideaId={video.id}
        initialCaption={savedCaption}
        initialDraft={video.caption_draft}
        platforms={platforms}
        hook={hook}
        visualBrief={visualBrief}
        captionAngle={captionAngle}
        hashtags={hashtags}
        onSaved={setSavedCaption}
      />

      {/* revisión del cliente — copiar link para WhatsApp + voto + hilo (Inc 4) */}
      <ReviewLinkPanel key={video.id} ideaId={video.id} hasEditedVideo={video.videos.edited.length > 0} />

      {/* detalle del fallo de publicación — visible para que el equipo sepa QUÉ falló */}
      {video.approval_status === 'approved' && video.metricool_post_id == null && !video.published_at &&
        !!video.posting_error?.trim() && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <span className="font-semibold">No se pudo publicar:</span> {video.posting_error}
          </p>
        )}

      {/* siguiente paso + acciones — revisión / aprobación / publicar a Metricool */}
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
        <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', NEXT_STEP_TONE[nextStep.tone])}>
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', NEXT_STEP_DOT[nextStep.tone])} aria-hidden />
          {nextStep.label}
        </span>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ApprovalButton
            ideaId={video.id}
            approvalStatus={video.approval_status}
            clientName={clientName}
            clientLogoUrl={clientLogoUrl}
            ideaTitle={video.title}
          />
          {video.approval_status === 'approved' && !(video.published_at || video.status === 'publicada') && (
            <PublishToMetricoolButton key={video.id} ideaId={video.id} metricoolPostId={video.metricool_post_id} />
          )}
        </div>
      </footer>
    </section>
  )
}
