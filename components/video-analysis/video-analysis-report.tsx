'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2, EyeOff, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getVideoAnalysis, type VideoAnalysisView } from '@/lib/actions/video-analysis'

const POLL_MS = 10_000
const POLL_GIVE_UP_MS = 5 * 60_000

/**
 * Reporte ADVISORY del QC IA (Grok 4.6). Solo superficies internas — nunca
 * montarlo en /review/<token> ni /aprobacion (links públicos de cliente).
 *
 * Mientras el análisis está 'pending' (el editor puede tener el panel abierto
 * mientras Grok procesa) reconsulta cada 10s hasta que el estado cambie, se
 * desmonte, o pasen ~5min — ahí se da por vencido y deja la tarjeta "Analizando…"
 * (nunca inventa un error).
 */
export function VideoAnalysisReport({ ideaId }: { ideaId: string }) {
  const [analysis, setAnalysis] = useState<VideoAnalysisView | null | undefined>(undefined)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const startedAt = Date.now()

    const fetchOnce = () => {
      getVideoAnalysis(ideaId)
        .then((res) => {
          if (!alive) return
          const next = res.analysis ?? null
          setAnalysis(next)
          if (next?.status === 'pending' && Date.now() - startedAt < POLL_GIVE_UP_MS) {
            timer = setTimeout(fetchOnce, POLL_MS)
          }
        })
        .catch(() => { if (alive) setAnalysis(null) })
    }
    fetchOnce()

    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [ideaId])

  if (analysis === undefined || analysis === null) return null

  if (analysis.status === 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analizando video con IA…
      </div>
    )
  }
  if (analysis.status === 'error' || !analysis.findings) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <EyeOff className="h-3.5 w-3.5" /> Análisis no disponible
      </div>
    )
  }

  const f = analysis.findings
  const captionsOk = f.burned_captions.issues.length === 0
  const relevanceOk = f.relevance.verdict === 'ok'

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
        {ok
          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('shrink-0 whitespace-nowrap text-[10px]', ok ? 'text-emerald-600' : 'text-amber-600')}>
        {detail}
      </span>
    </div>
  )

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">QC con IA (advisory)</p>
      <Row ok={captionsOk} label="Captions del video" detail={captionsOk ? 'Sin errores' : `${f.burned_captions.issues.length} a revisar`} />
      <Row ok={relevanceOk} label="Relevancia" detail={relevanceOk ? 'Relevante para el cliente' : 'Revisar'} />
      {(!captionsOk || !relevanceOk || f.visual_summary) && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} /> Detalles
        </button>
      )}
      {open && (
        <div className="space-y-2 text-xs">
          {f.burned_captions.issues.map((i, n) => (
            <p key={n} className="rounded-md bg-amber-500/10 px-2 py-1.5">
              «{i.quote}» — {i.problem}. Sugerencia: <span className="font-medium">{i.suggestion}</span>
            </p>
          ))}
          {!relevanceOk && <p className="rounded-md bg-amber-500/10 px-2 py-1.5">{f.relevance.explanation}</p>}
          {f.visual_summary && <p className="text-muted-foreground">{f.visual_summary}</p>}
        </div>
      )}
    </div>
  )
}
