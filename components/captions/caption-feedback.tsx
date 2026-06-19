'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { Wand2, Loader2, ThumbsUp, ThumbsDown, GraduationCap, BookPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { rateCaption, getCaptionLearningStats, appendClientCaptionRule, type CaptionTarget } from '@/lib/actions/caption-feedback'

interface Props {
  /** The caption being worked on (the text that gets rated). */
  caption: string
  /** Where the feedback belongs: a pipeline idea, or a client directly (quick/approved). */
  target: CaptionTarget
  /** Regenerate the caption applying the team's free-text feedback. */
  onRegenerate: (feedback: string) => void
  /** True while a (re)generation is in flight (drives the spinner + disables). */
  isGenerating: boolean
}

type Stats = { approved: number; loved: number; rejected: number; suggestions: { phrase: string; count: number }[] }

/**
 * THE caption feedback module — one component used by EVERY caption surface
 * (pipeline editor, Caption rápido, Ideas Aprobadas, …) so feedback works the
 * same everywhere. Bundles: "ajustar con feedback" + regenerate, 👍/👎 + nota,
 * the per-client learning transparency chip, and the recurring-👎 → "agregar a
 * reglas" suggestion. Render it under any caption; pass the surface's own
 * regenerate fn + the rating target.
 */
export function CaptionFeedback({ caption, target, onRegenerate, isGenerating }: Props) {
  const canUse = useHasPermission('captions.use')
  const canEditRules = useHasPermission('clients.brand.edit')
  const { toast } = useToast()

  const [feedback, setFeedback] = useState('')
  const [rated, setRated] = useState<1 | -1 | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [ratingNote, setRatingNote] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [isRating, startRate] = useTransition()
  const [isAddingRule, startAddRule] = useTransition()

  const targetKey = target.ideaId ?? target.clientId ?? ''
  const loadStats = useCallback(() => {
    getCaptionLearningStats(target).then(setStats).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey])

  // Fetch transparency stats when the target changes (and there's a caption).
  useEffect(() => {
    if (canUse && caption) loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse, targetKey])

  // A new/edited caption invalidates the previous vote indicator.
  useEffect(() => {
    setRated(null)
  }, [caption])

  if (!canUse || !caption) return null

  const learnedCount = (stats?.approved ?? 0) + (stats?.loved ?? 0)

  function regenerate() {
    const fb = feedback.trim()
    if (!fb) return
    onRegenerate(fb)
    setFeedback('')
  }

  function rate(value: 1 | -1, note?: string) {
    startRate(async () => {
      const res = await rateCaption({ ...target, rating: value, captionText: caption, note })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        setRated(value)
        setShowNote(false)
        setRatingNote('')
        toast({ title: value === 1 ? '👍 Guardado — la IA aprenderá de esto' : '👎 Anotado — la IA lo evitará' })
        loadStats()
      }
    })
  }

  function addRule(phrase: string) {
    startAddRule(async () => {
      const res = await appendClientCaptionRule(target, phrase)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        toast({ title: '✅ Agregado a las reglas del cliente' })
        setStats((s) => (s ? { ...s, suggestions: s.suggestions.filter((x) => x.phrase !== phrase) } : s))
      }
    })
  }

  return (
    <div className="space-y-2.5">
      {/* Ajustar con feedback */}
      <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/[0.04] p-2.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
          <Wand2 className="h-3 w-3 text-primary" aria-hidden /> Ajustar con feedback
        </p>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={2}
          placeholder="Dile a la IA qué cambiar: más corto, menos emojis, más llamado a la acción, tono más formal…"
          className="resize-none text-xs"
        />
        <Button size="sm" variant="outline" onClick={regenerate} disabled={isGenerating || !feedback.trim()}>
          {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
          Regenerar con feedback
        </Button>
      </div>

      {/* 👍 / 👎 */}
      <div className="space-y-2 border-t border-border/60 pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">¿Qué tal este caption? La IA aprende de tu voto.</span>
          <Button size="sm" variant="outline" disabled={isRating} onClick={() => rate(1)} className={rated === 1 ? 'border-emerald-500/50 text-emerald-500' : ''}>
            <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Me gusta
          </Button>
          <Button size="sm" variant="outline" disabled={isRating} onClick={() => setShowNote((v) => !v)} className={rated === -1 ? 'border-red-500/50 text-red-400' : ''}>
            <ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> No es
          </Button>
          {rated && <span className="text-[11px] text-emerald-500">¡Gracias! Guardado.</span>}
        </div>
        {showNote && (
          <div className="flex flex-col gap-1.5">
            <Textarea
              value={ratingNote}
              onChange={(e) => setRatingNote(e.target.value)}
              rows={2}
              placeholder="¿Qué estuvo mal? (opcional) — p. ej. demasiados emojis, muy genérico, tono equivocado…"
              className="resize-none text-xs"
            />
            <Button size="sm" disabled={isRating} onClick={() => rate(-1, ratingNote)} className="self-start">
              {isRating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />}
              Enviar voto
            </Button>
          </div>
        )}

        {/* Transparencia: cuánto del cliente ya alimenta al generador */}
        {learnedCount > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-primary/90">
            <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            La IA está aprendiendo de <strong>{learnedCount}</strong> caption{learnedCount === 1 ? '' : 's'} de este cliente
            {stats && stats.rejected > 0 ? ` (y evita ${stats.rejected} rechazado${stats.rejected === 1 ? '' : 's'})` : ''}.
          </p>
        )}

        {/* Auto-regla: un 👎 que se repite → ofrecer hacerlo regla fija */}
        {canEditRules &&
          stats?.suggestions.map((s) => (
            <div key={s.phrase} className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-2">
              <span className="text-[11px] text-foreground/80">
                El equipo repite <strong>«{s.phrase}»</strong> ({s.count}×). ¿Hacerla regla fija del cliente?
              </span>
              <Button size="sm" variant="outline" disabled={isAddingRule} onClick={() => addRule(s.phrase)} className="ml-auto">
                {isAddingRule ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BookPlus className="mr-1.5 h-3.5 w-3.5" />}
                Agregar a reglas
              </Button>
            </div>
          ))}
      </div>
    </div>
  )
}
