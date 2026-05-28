'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Save, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { generateIdeaCaption, saveIdeaCaption } from '@/lib/actions/idea-captions'

interface Props {
  ideaId: string
  initialCaption: string | null
  initialPlatform: string | null
}

export function IdeaCaptionEditor({ ideaId, initialCaption, initialPlatform }: Props) {
  const canUse = useHasPermission('captions.use')
  const [caption, setCaption] = useState(initialCaption ?? '')
  const [platform, setPlatform] = useState(initialPlatform ?? 'instagram')
  const [isGenerating, startGenerate] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const dirty = caption !== (initialCaption ?? '')

  function generate() {
    startGenerate(async () => {
      const res = await generateIdeaCaption(ideaId, platform)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaption(res.caption)
        toast({ title: 'Caption generado' })
      }
    })
  }

  function save() {
    startSave(async () => {
      const res = await saveIdeaCaption(ideaId, caption, platform)
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
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
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
