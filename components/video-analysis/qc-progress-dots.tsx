'use client'

import { useState } from 'react'
import { CheckCircle2, AlertCircle, ChevronDown, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { useVideoAnalysisPolling } from '@/lib/hooks/use-video-analysis-polling'
import { analyzeExistingVideo } from '@/lib/utils/video-analysis-client'

type DotState = 'working' | 'ok' | 'warning' | 'unavailable'
type RunPhase = 'extracting' | 'analyzing'

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
 *
 * `videoId` habilita el botón "Analizar con IA" (sin análisis todavía) /
 * "Re-analizar" (ya hay uno): dispara `analyzeExistingVideo`, que hace en el
 * browser exactamente lo mismo que al subir pero sacando el video del proxy
 * de mismo origen (`/api/video-file/[videoId]`) en vez del disco — una URL
 * firmada de R2 no serviría: sin CORS ahí, el canvas quedaría "tainted" y
 * `toDataURL()` lanzaría (v3.39).
 */
export function QcProgressDots({ ideaId, videoId }: { ideaId: string; videoId?: string }) {
  const { toast } = useToast()
  const canAnalyze = useHasPermission('video.upload')
  const [refreshToken, setRefreshToken] = useState(0)
  const [phase, setPhase] = useState<RunPhase | null>(null)
  // Sigue sondeando más allá de 'done' mientras el caption todavía no
  // exista: el análisis de video y generateIdeaCaption terminan en
  // momentos distintos (ver comentario del hook).
  const analysis = useVideoAnalysisPolling(ideaId, (a) => !a.hasCaption, refreshToken)
  const [openRelevance, setOpenRelevance] = useState(false)
  const [openCaptions, setOpenCaptions] = useState(false)

  const running = phase !== null

  async function runAnalysis() {
    if (!videoId || running) return
    setPhase('extracting')
    const res = await analyzeExistingVideo(videoId, { onProgress: setPhase })
    setPhase(null)
    // Refresca vía el mismo hook (sin fetch paralelo): para cuando esta
    // promesa resuelve, la ruta ya terminó de escribir status/findings.
    setRefreshToken((t) => t + 1)
    if ('error' in res) {
      toast({ title: 'No se pudo analizar el video', description: res.error, variant: 'destructive' })
    }
  }

  if (analysis === undefined) return null // cargando: nada que mostrar todavía

  if (analysis === null) {
    // Sin fila de análisis: puede ser "no hay video editado" (no hay nada
    // que ofrecer) o "hay video pero nunca se analizó" (videoId presente) —
    // solo en el 2do caso, y solo con permiso, se ofrece el botón.
    if (!videoId || !canAnalyze) return null
    return (
      <div className="rounded-lg border border-dashed bg-card p-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
        <Button type="button" size="sm" variant="outline" onClick={runAnalysis} disabled={running} className="w-full">
          {running ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {phase === 'extracting' ? 'Extrayendo fotogramas…' : 'Analizando…'}
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Analizar con IA
            </>
          )}
        </Button>
      </div>
    )
  }

  const { status, findings, hasCaption, frameCount } = analysis
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
      <div className="flex items-center justify-between gap-x-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">QC con IA (advisory)</p>
        {videoId && canAnalyze && (
          <button
            type="button"
            onClick={runAnalysis}
            disabled={running}
            className="shrink-0 whitespace-nowrap text-[10px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {phase === 'extracting' ? 'Extrayendo fotogramas…' : 'Analizando…'}
              </span>
            ) : (
              'Re-analizar'
            )}
          </button>
        )}
      </div>

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

      {typeof frameCount === 'number' && frameCount > 0 && (
        <p className="ml-[22px] text-[10px] text-muted-foreground">
          {frameCount} {frameCount === 1 ? 'fotograma analizado' : 'fotogramas analizados'}
        </p>
      )}
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
