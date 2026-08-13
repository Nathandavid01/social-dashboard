'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Save, Copy, Check, Globe, Lightbulb, AlertCircle } from 'lucide-react'
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
  /** The caption a human already saved. Non-empty = the video moved on. */
  initialCaption: string | null
  /** Unsaved AI text from a previous visit, so a reload doesn't lose it. */
  initialDraft?: string | null
  /** The client's networks — shown as badges. ONE caption is written for all of them. */
  platforms?: SocialPlatform[]
  hook?: string | null
  visualBrief?: string | null
  captionAngle?: string | null
  hashtags?: string | null
  /** Caption is locked until there is footage. */
  hasVideo?: boolean
  onSaved?: (caption: string) => void
}

/**
 * Caption único: a single caption per video that goes to ALL the client's
 * networks. Generated from what the video says (Whisper) plus the idea brief.
 *
 * Generar ≠ guardar. What the AI writes is a draft nobody has read yet; only
 * "Guardar caption" persists it as the real caption and fires `onSaved`, which
 * is the signal the surrounding screens use to move the video along.
 */
export function IdeaCaptionEditor({
  ideaId,
  initialCaption,
  initialDraft,
  platforms = [],
  hook,
  visualBrief,
  captionAngle,
  hashtags,
  hasVideo = false,
  onSaved,
}: Props) {
  const canUse = useHasPermission('captions.use')
  // A saved caption wins over a leftover draft — the draft is only what's
  // pending when nothing has been settled yet.
  const [caption, setCaption] = useState(initialCaption || initialDraft || '')
  const [isGenerating, startGenerate] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const ideaReady = isIdeaReadyForCaption({ hook, visual_brief: visualBrief, hasVideo })
  const missing = ideaReadyMissingLabels({ hook, visual_brief: visualBrief, caption_angle: captionAngle, hasVideo })
  const dirty = caption !== (initialCaption ?? '')
  // Hay texto en pantalla que todavía no es el caption del video. Se avisa
  // fuerte: mientras esto se vea, el video NO se ha movido de Copy.
  const unsaved = dirty && !!caption.trim()

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
        // Sin onSaved: es un borrador. Avisar aquí sacaba el video de la cola
        // de Copy antes de que nadie lo leyera.
        setCaption(res.caption)
        toast({ title: 'Borrador listo', description: 'Revísalo y guárdalo — el video no se mueve hasta entonces.' })
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
        toast({ title: 'Borrador regenerado', description: 'Sigue sin guardar — revísalo.' })
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Caption</span>
        <span className="min-w-0 text-[10px] text-muted-foreground">— basado en lo que se oye en el video</span>
        {unsaved && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" aria-hidden /> Borrador sin guardar
          </span>
        )}
      </div>

      {ideaReady ? (
        <div className="space-y-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium text-foreground/80">
            <Lightbulb className="h-3 w-3 text-purple-500" aria-hidden />
            La IA escucha el video
          </p>
          <p>Escribe el copy sobre lo que se dice. El hook de abajo es contexto.</p>
          {hook && <p><span className="font-medium text-foreground/70">De qué es:</span> {hook}</p>}
          {visualBrief && <p><span className="font-medium text-foreground/70">Brief visual:</span> {visualBrief}</p>}
          {captionAngle && <p><span className="font-medium text-foreground/70">Ángulo:</span> {captionAngle}</p>}
          {hashtags && <p className="font-mono text-[11px]">{hashtags}</p>}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400">
          {missing.includes('el video')
            ? 'Sube un video primero. El caption se escribe sobre la grabación, no sobre la idea vacía.'
            : 'Di de qué es el video (arriba) y la AI escribe el caption.'}
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
            {caption ? 'Regenerar con IA' : 'Generar desde el video'}
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
            ? 'Genera el caption desde el video o escríbelo aquí…'
            : missing.includes('el video')
              ? 'Primero sube el video…'
              : 'Primero di de qué es el video…'
        }
        className="resize-none text-sm leading-relaxed"
        disabled={!ideaReady}
      />

      {/* THE shared caption feedback module — same everywhere captions are made. */}
      <CaptionFeedback caption={caption} target={{ ideaId }} onRegenerate={regenerateWithFeedback} isGenerating={isGenerating} />

      {dirty && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-3">
          <Button size="sm" onClick={save} disabled={isSaving || !ideaReady || !caption.trim()}>
            {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Guardar caption
          </Button>
          <span className="min-w-0 text-[11px] text-muted-foreground">
            Guardar es lo que mueve el video a Publicación.
          </span>
        </div>
      )}
    </div>
  )
}
