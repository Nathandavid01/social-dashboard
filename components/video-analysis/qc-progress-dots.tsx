'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVideoAnalysisPolling } from '@/lib/hooks/use-video-analysis-polling'

type DotState = 'working' | 'ok' | 'warning' | 'unavailable'

/**
 * Tira de 3 bolitas QC ("de un vistazo"): es la nueva cara del reporte QC IA
 * — reemplaza `VideoAnalysisReport` en `IdeaVideoPanel` (mismo fetch/poll,
 * compartido vía `useVideoAnalysisPolling`, así que no hay doble fetch).
 * `VideoAnalysisReport` sigue viva para `review-overlay.tsx`.
 *
 * 1. Relevancia ("Es del cliente")
 * 2. Captions quemados sin faltas ("Libre de errores")
 * 3. Caption ya escrito ("Caption generado") — independiente del QC de
 *    video: se alimenta de `hasCaption`, no de `status`.
 */
export function QcProgressDots({ ideaId }: { ideaId: string }) {
  // Sigue sondeando más allá de 'done' mientras el caption todavía no
  // exista: el análisis de video y generateIdeaCaption terminan en
  // momentos distintos (ver comentario del hook).
  const analysis = useVideoAnalysisPolling(ideaId, (a) => !a.hasCaption)
  const [openRelevance, setOpenRelevance] = useState(false)
  const [openCaptions, setOpenCaptions] = useState(false)

  if (analysis === undefined || analysis === null) return null

  const { status, findings, hasCaption } = analysis
  const dataAvailable = status === 'done' && !!findings
  const captionIssues = findings?.burned_captions.issues ?? []
  const relevanceOk = findings?.relevance.verdict === 'ok'

  const relevanceState: DotState =
    status === 'pending' ? 'working' : dataAvailable ? (relevanceOk ? 'ok' : 'warning') : 'unavailable'
  const captionsState: DotState =
    status === 'pending' ? 'working' : dataAvailable ? (captionIssues.length === 0 ? 'ok' : 'warning') : 'unavailable'
  const captionDraftState: DotState = hasCaption ? 'ok' : 'working'

  const relevanceText =
    relevanceState === 'working' ? 'Analizando…'
    : relevanceState === 'ok' ? 'Es del cliente'
    : relevanceState === 'warning' ? 'No parece de este cliente'
    : 'Análisis no disponible'

  const captionsText =
    captionsState === 'working' ? 'Analizando…'
    : captionsState === 'ok' ? 'Libre de errores'
    : captionsState === 'warning' ? `${captionIssues.length} error${captionIssues.length === 1 ? '' : 'es'} a revisar`
    : 'Análisis no disponible'

  const captionDraftText = captionDraftState === 'ok' ? 'Caption generado' : 'Generando caption…'

  return (
    <div className="space-y-1.5 rounded-lg border bg-card p-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">QC con IA (advisory)</p>

      <QcDot state={relevanceState} text={relevanceText} expanded={openRelevance} onToggle={relevanceState === 'warning' ? () => setOpenRelevance((o) => !o) : undefined} />
      {openRelevance && relevanceState === 'warning' && (
        <p className="ml-[22px] rounded-md bg-amber-500/10 px-2 py-1.5 text-xs">{findings?.relevance.explanation}</p>
      )}

      <QcDot state={captionsState} text={captionsText} expanded={openCaptions} onToggle={captionsState === 'warning' ? () => setOpenCaptions((o) => !o) : undefined} />
      {openCaptions && captionsState === 'warning' && (
        <div className="ml-[22px] space-y-1.5">
          {captionIssues.map((issue, n) => (
            <p key={n} className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs">
              «{issue.quote}» — {issue.problem}. Sugerencia: <span className="font-medium">{issue.suggestion}</span>
            </p>
          ))}
        </div>
      )}

      <QcDot state={captionDraftState} text={captionDraftText} />
    </div>
  )
}

function QcDot({
  state, text, expanded, onToggle,
}: {
  state: DotState
  text: string
  expanded?: boolean
  onToggle?: () => void
}) {
  const circle =
    state === 'ok' ? (
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
    ) : state === 'warning' ? (
      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
    ) : state === 'working' ? (
      <span className="h-3 w-3 shrink-0 rounded-full border-2 border-dashed border-muted-foreground/50 motion-safe:animate-pulse" aria-hidden />
    ) : (
      <span className="h-3 w-3 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
    )

  const textCls = cn(
    'min-w-0 truncate text-xs',
    state === 'ok' && 'font-medium',
    state === 'warning' && 'font-medium text-amber-600',
    (state === 'working' || state === 'unavailable') && 'text-muted-foreground',
  )

  const content = (
    <span className="flex min-w-0 items-center gap-2">
      {circle}
      <span className={textCls}>{text}</span>
    </span>
  )

  if (onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left hover:opacity-80"
      >
        {content}
        <ChevronDown className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>
    )
  }

  return <div className="flex items-center gap-2">{content}</div>
}
