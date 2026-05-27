'use client'

import { useState } from 'react'
import type { Client, ContentIdea, ContentIdeaType } from '@/lib/supabase/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, Loader2, Film, Image as ImageIcon, LayoutGrid, Circle } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { saveContentIdea } from '@/lib/actions/content-ideas'
import { cn } from '@/lib/utils'

const TYPE_OPTIONS: { value: ContentIdeaType; label: string; icon: React.ElementType }[] = [
  { value: 'R', label: 'Reel', icon: Film },
  { value: 'P', label: 'Post', icon: ImageIcon },
  { value: 'C', label: 'Carrusel', icon: LayoutGrid },
  { value: 'S', label: 'Story', icon: Circle },
]

interface Props {
  open: boolean
  onClose: () => void
  clients: Client[]
  defaultClientId?: string
  defaultTheme?: string
  defaultTypes?: ContentIdeaType[]
  onIdeasGenerated: (ideas: ContentIdea[]) => void
}

export function GenerateIdeasModal({
  open,
  onClose,
  clients,
  defaultClientId,
  defaultTheme,
  defaultTypes,
  onIdeasGenerated,
}: Props) {
  const { toast } = useToast()
  const [clientId, setClientId] = useState<string>(defaultClientId ?? '')
  const [selectedTypes, setSelectedTypes] = useState<Set<ContentIdeaType>>(
    new Set(defaultTypes ?? (['R', 'P', 'C'] as ContentIdeaType[]))
  )
  const [theme, setTheme] = useState(defaultTheme ?? '')
  const [count, setCount] = useState(5)
  const [generating, setGenerating] = useState(false)

  function toggleType(t: ContentIdeaType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  async function handleGenerate() {
    if (!clientId) {
      toast({ title: 'Falta cliente', description: 'Selecciona un cliente', variant: 'destructive' })
      return
    }
    if (selectedTypes.size === 0) {
      toast({ title: 'Falta tipo', description: 'Selecciona al menos un tipo de contenido', variant: 'destructive' })
      return
    }

    const client = clients.find((c) => c.id === clientId)
    if (!client) return

    setGenerating(true)
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: client.name,
          industry: client.industry,
          brandVoice: client.brand_voice,
          captionLanguage: client.caption_language,
          defaultCta: client.default_cta,
          defaultHashtags: client.default_hashtags,
          captionNotes: client.caption_notes,
          metricoolBlogId: client.metricool_blog_id,
          contentTypes: Array.from(selectedTypes),
          theme: theme.trim() || undefined,
          count,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error generando ideas')

      // Save each idea to DB
      const saved: ContentIdea[] = []
      for (const i of data.ideas as Array<{
        content_type: ContentIdeaType
        title: string
        hook: string
        visual_brief: string
        caption_angle: string
        hashtags_suggestion: string
        rationale: string
      }>) {
        const result = await saveContentIdea({
          clientId,
          contentType: i.content_type,
          title: i.title,
          hook: i.hook,
          visualBrief: i.visual_brief,
          captionAngle: i.caption_angle,
          hashtagsSuggestion: i.hashtags_suggestion,
          rationale: i.rationale,
          theme: theme.trim() || null,
          generationPrompt: theme.trim() || null,
          model: data.model,
        })
        if (result.idea) saved.push(result.idea)
      }

      // Hydrate with client info so the card renders nicely
      const hydrated = saved.map((idea) => ({
        ...idea,
        client: { id: client.id, name: client.name, industry: client.industry },
      }))

      onIdeasGenerated(hydrated)
      toast({
        title: `${saved.length} ideas generadas`,
        description: data.examplesUsed > 0 ? `Basado en ${data.examplesUsed} posts recientes` : undefined,
      })
      onClose()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudieron generar ideas',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Generar ideas con IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={generating}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipos de contenido</Label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                const checked = selectedTypes.has(value)
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={generating}
                    onClick={() => toggleType(value)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition-colors',
                      checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Brief / Tema (opcional)</Label>
            <Textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ej: lanzamiento de menú nuevo, behind-the-scenes, semana de promociones..."
              rows={3}
              disabled={generating}
              className="text-sm resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              Déjalo vacío para ideas variadas basadas en el perfil del cliente.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cantidad</Label>
            <Select value={String(count)} onValueChange={(v) => setCount(parseInt(v))} disabled={generating}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} ideas</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || !clientId || selectedTypes.size === 0}
            className="w-full gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Generando...' : `Generar ${count} ideas`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
