'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Save, Copy, Check, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { generateIdeaCaption, saveIdeaCaption } from '@/lib/actions/idea-captions'
import { PlatformBadges } from '@/components/clients/platform-badges'
import type { SocialPlatform } from '@/lib/supabase/types'

interface Props {
  ideaId: string
  initialCaption: string | null
  /** The client's networks — shown as badges. ONE caption is written for all of them. */
  platforms?: SocialPlatform[]
}

/**
 * Caption único: a single caption per video that goes to ALL the client's
 * networks (Instagram, TikTok, Facebook, …). No per-platform selection — the
 * publisher posts the same text to every connected network.
 */
export function IdeaCaptionEditor({ ideaId, initialCaption, platforms = [] }: Props) {
  const canUse = useHasPermission('captions.use')
  const [caption, setCaption] = useState(initialCaption ?? '')
  const [isGenerating, startGenerate] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const dirty = caption !== (initialCaption ?? '')

  function generate() {
    startGenerate(async () => {
      const res = await generateIdeaCaption(ideaId)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaption(res.caption)
        toast({ title: 'Caption generado' })
      }
    })
  }

  function save() {
    startSave(async () => {
      const res = await saveIdeaCaption(ideaId, caption)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Caption guardado' })
    })
  }

  function copy() {
    navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-3">
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
          <Button size="sm" variant="outline" onClick={generate} disabled={isGenerating} className="transition-transform hover:scale-105">
            {isGenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            {caption ? 'Regenerar con IA' : 'Generar con IA'}
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
        placeholder="Genera el caption con IA o escríbelo aquí…"
        className="resize-none text-sm leading-relaxed"
      />

      {dirty && (
        <Button size="sm" onClick={save} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Guardar caption
        </Button>
      )}
    </div>
  )
}
