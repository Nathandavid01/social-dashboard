'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { Sparkles, Loader2, Save, Copy, Check, Globe, Lightbulb, Wand2, ThumbsUp, ThumbsDown, GraduationCap, BookPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { generateIdeaCaption, saveIdeaCaption } from '@/lib/actions/idea-captions'
import { rateCaption, getCaptionLearningStats, appendClientCaptionRule } from '@/lib/actions/caption-feedback'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { isIdeaReadyForCaption, ideaReadyMissingLabels } from '@/lib/utils/idea-ready'
import type { SocialPlatform } from '@/lib/supabase/types'

interface Props {
  ideaId: string
  initialCaption: string | null
  /** The client's networks — shown as badges. ONE caption is written for all of them. */
  platforms?: SocialPlatform[]
  hook?: string | null
  visualBrief?: string | null
  captionAngle?: string | null
  hashtags?: string | null
  onSaved?: (caption: string) => void
}

/**
 * Caption único: a single caption per video that goes to ALL the client's
 * networks. Generated from the idea brief (hook + visual brief + angle) so
 * recording follows a clear script.
 */
export function IdeaCaptionEditor({
  ideaId,
  initialCaption,
  platforms = [],
  hook,
  visualBrief,
  captionAngle,
  hashtags,
  onSaved,
}: Props) {
  const canUse = useHasPermission('captions.use')
  const [caption, setCaption] = useState(initialCaption ?? '')
  const [feedback, setFeedback] = useState('')
  const [isGenerating, startGenerate] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [isRating, startRate] = useTransition()
  const [rated, setRated] = useState<1 | -1 | null>(null)
  const [showNote, setShowNote] = useState(false)
  const [ratingNote, setRatingNote] = useState('')
  const [copied, setCopied] = useState(false)
  const canEditRules = useHasPermission('clients.brand.edit')
  const [stats, setStats] = useState<{ approved: number; loved: number; rejected: number; suggestions: { phrase: string; count: number }[] } | null>(null)
  const [isAddingRule, startAddRule] = useTransition()
  const { toast } = useToast()

  // Transparency: how much this client's history already informs generation.
  const loadStats = useCallback(() => {
    getCaptionLearningStats(ideaId).then(setStats).catch(() => {})
  }, [ideaId])
  useEffect(() => {
    if (canUse && caption) loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse, ideaId])

  const learnedCount = (stats?.approved ?? 0) + (stats?.loved ?? 0)

  function rate(value: 1 | -1, note?: string) {
    startRate(async () => {
      const res = await rateCaption({ ideaId, rating: value, captionText: caption, note })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        setRated(value)
        setShowNote(false)
        setRatingNote('')
        toast({ title: value === 1 ? '👍 Guardado — la IA aprenderá de esto' : '👎 Anotado — la IA lo evitará' })
        loadStats() // refresh the chip + suggestions after a vote
      }
    })
  }

  function addRule(phrase: string) {
    startAddRule(async () => {
      const res = await appendClientCaptionRule(ideaId, phrase)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        toast({ title: '✅ Agregado a las reglas del cliente' })
        setStats((s) => (s ? { ...s, suggestions: s.suggestions.filter((x) => x.phrase !== phrase) } : s))
      }
    })
  }

  const ideaReady = isIdeaReadyForCaption({ hook, visual_brief: visualBrief })
  const missing = ideaReadyMissingLabels({ hook, visual_brief: visualBrief, caption_angle: captionAngle })
  const dirty = caption !== (initialCaption ?? '')

  function generate() {
    if (!ideaReady) {
      toast({
        title: 'Completa la idea primero',
        description: `Falta: ${missing.join(', ')}`,
        variant: 'destructive',
      })
      return
    }
    startGenerate(async () => {
      const res = await generateIdeaCaption(ideaId)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaption(res.caption)
        setRated(null)
        onSaved?.(res.caption)
        toast({ title: 'Caption generado desde la idea' })
      }
    })
  }

  function regenerateWithFeedback() {
    const fb = feedback.trim()
    if (!fb) return
    startGenerate(async () => {
      const res = await generateIdeaCaption(ideaId, { feedback: fb, previousCaption: caption })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaption(res.caption)
        setRated(null)
        onSaved?.(res.caption)
        setFeedback('')
        toast({ title: 'Caption regenerado con tu feedback' })
      }
    })
  }

  function save() {
    startSave(async () => {
      const res = await saveIdeaCaption(ideaId, caption)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        onSaved?.(caption)
        toast({ title: 'Caption guardado' })
      }
    })
  }

  function copy() {
    navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Caption</span>
        <span className="text-[10px] text-muted-foreground">— basado en la idea de arriba</span>
      </div>

      {ideaReady ? (
        <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Lightbulb className="h-3 w-3 text-purple-500" aria-hidden />
            Idea para este caption
          </p>
          {hook && <p><span className="font-medium text-foreground/70">Hook:</span> {hook}</p>}
          {visualBrief && <p><span className="font-medium text-foreground/70">Brief visual:</span> {visualBrief}</p>}
          {captionAngle && <p><span className="font-medium text-foreground/70">Ángulo:</span> {captionAngle}</p>}
          {hashtags && <p className="font-mono text-[11px]">{hashtags}</p>}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400">
          Completa el hook y el brief visual de la idea antes del caption. Así sabrás qué decir al grabar.
          {missing.length > 0 && <span className="mt-1 block">Falta: {missing.join(', ')}</span>}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Una caption para todas las redes
          {platforms.length > 0 && (
            <span className="ml-0.5 flex items-center gap-1 [&_svg]:h-3.5 [&_svg]:w-3.5">
              <PlatformBadges platforms={platforms} />
            </span>
          )}
        </span>
        {canUse && (
          <Button
            size="sm"
            variant="outline"
            onClick={generate}
            disabled={isGenerating || !ideaReady}
            className="transition-transform hover:scale-105"
          >
            {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {caption ? 'Regenerar con IA' : 'Generar desde la idea'}
          </Button>
        )}
        {caption && (
          <Button size="sm" variant="ghost" onClick={copy} className="text-muted-foreground">
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5 text-green-500" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        )}
      </div>

      <Textarea
        value={caption}
        onChange={(e) => { setCaption(e.target.value); setRated(null) }}
        rows={8}
        placeholder={
          ideaReady
            ? 'Genera el caption desde la idea o escríbelo aquí antes de grabar…'
            : 'Primero completa la idea (hook + brief visual)…'
        }
        className="resize-none text-sm leading-relaxed"
        disabled={!ideaReady}
      />

      {/* Feedback loop: tell the AI what to change and it rewrites the caption */}
      {canUse && caption && (
        <div className="space-y-1.5 rounded-md border border-primary/20 bg-primary/[0.04] p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
            <Wand2 className="h-3 w-3 text-primary" aria-hidden />
            Ajustar con feedback
          </p>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Dile a la IA qué cambiar: más corto, menos emojis, más llamado a la acción, tono más formal…"
            className="resize-none text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={regenerateWithFeedback}
            disabled={isGenerating || !feedback.trim()}
          >
            {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
            Regenerar con feedback
          </Button>
        </div>
      )}

      {/* Rating loop (fase 2): 👍/👎 + nota → la IA aprende qué imitar y qué evitar */}
      {canUse && caption && (
        <div className="space-y-2 border-t border-border/60 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">¿Qué tal este caption? La IA aprende de tu voto.</span>
            <Button
              size="sm"
              variant="outline"
              disabled={isRating}
              onClick={() => rate(1)}
              className={rated === 1 ? 'border-emerald-500/50 text-emerald-500' : ''}
            >
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Me gusta
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isRating}
              onClick={() => setShowNote((v) => !v)}
              className={rated === -1 ? 'border-red-500/50 text-red-400' : ''}
            >
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
              <div>
                <Button size="sm" disabled={isRating} onClick={() => rate(-1, ratingNote)}>
                  {isRating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />}
                  Enviar voto
                </Button>
              </div>
            </div>
          )}

          {/* Transparency: this client's history already feeding the generator */}
          {learnedCount > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-primary/90">
              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              La IA está aprendiendo de <strong>{learnedCount}</strong> caption{learnedCount === 1 ? '' : 's'} de este cliente
              {stats && stats.rejected > 0 ? ` (y evita ${stats.rejected} rechazado${stats.rejected === 1 ? '' : 's'})` : ''}.
            </p>
          )}

          {/* Auto-rule: a 👎 reason that keeps repeating → offer to make it a standing rule */}
          {canEditRules &&
            stats?.suggestions.map((s) => (
              <div
                key={s.phrase}
                className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-2"
              >
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
      )}

      {dirty && (
        <Button size="sm" onClick={save} disabled={isSaving || !ideaReady}>
          {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Guardar caption
        </Button>
      )}
    </div>
  )
}
