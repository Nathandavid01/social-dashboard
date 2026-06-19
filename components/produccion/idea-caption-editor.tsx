'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Save, Copy, Check, Globe, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { generateIdeaCaption, saveIdeaCaption } from '@/lib/actions/idea-captions'
import { CaptionFeedback } from '@/components/captions/caption-feedback'
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
  const [isGenerating, startGenerate] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

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
        onSaved?.(res.caption)
        toast({ title: 'Caption generado desde la idea' })
      }
    })
  }

  function regenerateWithFeedback(fb: string) {
    if (!fb.trim()) return
    startGenerate(async () => {
      const res = await generateIdeaCaption(ideaId, { feedback: fb, previousCaption: caption })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaption(res.caption)
        onSaved?.(res.caption)
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
        onChange={(e) => setCaption(e.target.value)}
        rows={8}
        placeholder={
          ideaReady
            ? 'Genera el caption desde la idea o escríbelo aquí antes de grabar…'
            : 'Primero completa la idea (hook + brief visual)…'
        }
        className="resize-none text-sm leading-relaxed"
        disabled={!ideaReady}
      />

      {/* THE shared caption feedback module — same everywhere captions are made. */}
      <CaptionFeedback caption={caption} target={{ ideaId }} onRegenerate={regenerateWithFeedback} isGenerating={isGenerating} />

      {dirty && (
        <Button size="sm" onClick={save} disabled={isSaving || !ideaReady}>
          {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Guardar caption
        </Button>
      )}
    </div>
  )
}
