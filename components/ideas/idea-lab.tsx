'use client'

import { useEffect, useState } from 'react'
import type { Client, ContentIdeaType } from '@/lib/supabase/types'
import type { TrendItem } from '@/lib/utils/trends'
import { rateIdea } from '@/lib/actions/idea-feedback'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  Loader2,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  Circle,
  TrendingUp,
  Plus,
  X,
  Check,
} from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'

const TYPE_OPTIONS: { value: ContentIdeaType; label: string; icon: React.ElementType }[] = [
  { value: 'R', label: 'Reel', icon: Film },
  { value: 'P', label: 'Post', icon: ImageIcon },
  { value: 'C', label: 'Carrusel', icon: LayoutGrid },
  { value: 'S', label: 'Story', icon: Circle },
]

const TYPE_LABEL: Record<ContentIdeaType, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

const NO_CLIENT = '__general__'

interface GeneratedIdea {
  content_type: ContentIdeaType
  objective?: string
  funnel_stage?: string
  title: string
  hook: string
  visual_brief: string
  caption_angle: string
  hashtags_suggestion: string
  rationale: string
}

interface Props {
  clients: Client[]
}

export function IdeaLab({ clients }: Props) {
  const { toast } = useToast()
  const [clientId, setClientId] = useState<string>(NO_CLIENT)
  const [selectedTypes, setSelectedTypes] = useState<Set<ContentIdeaType>>(
    new Set(['R', 'P', 'C'] as ContentIdeaType[])
  )
  const [theme, setTheme] = useState('')
  const [count, setCount] = useState(5)
  const [generating, setGenerating] = useState(false)

  const [liveTrends, setLiveTrends] = useState<TrendItem[]>([])
  const [trendsLoading, setTrendsLoading] = useState(true)
  const [selectedTrends, setSelectedTrends] = useState<Set<string>>(new Set())
  const [manualTrend, setManualTrend] = useState('')
  const [manualTrends, setManualTrends] = useState<string[]>([])

  const [ideas, setIdeas] = useState<GeneratedIdea[]>([])
  const [verdicts, setVerdicts] = useState<Record<number, 'approved' | 'rejected'>>({})

  useEffect(() => {
    let active = true
    fetch('/api/trends')
      .then((r) => r.json())
      .then((data) => {
        if (active) setLiveTrends(Array.isArray(data.trends) ? data.trends : [])
      })
      .catch(() => {
        if (active) setLiveTrends([])
      })
      .finally(() => {
        if (active) setTrendsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  function toggleType(t: ContentIdeaType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  function toggleTrend(title: string) {
    setSelectedTrends((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  function addManualTrend() {
    const v = manualTrend.trim()
    if (!v) return
    setManualTrends((prev) => (prev.includes(v) ? prev : [...prev, v]))
    setSelectedTrends((prev) => new Set(prev).add(v))
    setManualTrend('')
  }

  function removeManualTrend(v: string) {
    setManualTrends((prev) => prev.filter((t) => t !== v))
    setSelectedTrends((prev) => {
      const next = new Set(prev)
      next.delete(v)
      return next
    })
  }

  async function handleGenerate() {
    if (selectedTypes.size === 0) {
      toast({ title: 'Falta tipo', description: 'Selecciona al menos un tipo de contenido', variant: 'destructive' })
      return
    }

    const client = clientId !== NO_CLIENT ? clients.find((c) => c.id === clientId) : undefined
    const trends = Array.from(selectedTrends)

    setGenerating(true)
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client?.id,
          clientName: client?.name,
          industry: client?.industry,
          brandVoice: client?.brand_voice,
          captionLanguage: client?.caption_language,
          defaultCta: client?.default_cta,
          defaultHashtags: client?.default_hashtags,
          captionNotes: client?.caption_notes,
          metricoolBlogId: client?.metricool_blog_id,
          contentTypes: Array.from(selectedTypes),
          theme: theme.trim() || undefined,
          trends,
          count,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error generando ideas')
      setIdeas(Array.isArray(data.ideas) ? data.ideas : [])
      setVerdicts({})
      toast({ title: `${data.ideas?.length ?? 0} ideas generadas` })
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

  async function handleRate(idea: GeneratedIdea, index: number, verdict: 'approved' | 'rejected') {
    const client = clientId !== NO_CLIENT ? clients.find((c) => c.id === clientId) : undefined
    setVerdicts((prev) => ({ ...prev, [index]: verdict })) // optimistic
    const res = await rateIdea({
      verdict,
      clientId: client?.id ?? null,
      contentType: idea.content_type,
      objective: idea.objective ?? null,
      funnelStage: idea.funnel_stage ?? null,
      title: idea.title,
      hook: idea.hook,
      visualBrief: idea.visual_brief,
      captionAngle: idea.caption_angle,
      hashtagsSuggestion: idea.hashtags_suggestion,
      rationale: idea.rationale,
      theme: theme.trim() || null,
      trends: Array.from(selectedTrends),
    })
    if (!res.ok) {
      setVerdicts((prev) => {
        const next = { ...prev }
        delete next[index]
        return next
      })
      toast({
        title: 'No se pudo guardar',
        description: res.error ?? 'Inténtalo de nuevo',
        variant: 'destructive',
      })
    } else {
      toast({ title: verdict === 'approved' ? 'Idea aprobada ✓' : 'Idea descartada' })
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Controls */}
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-xs">Cliente (opcional)</Label>
          <Select value={clientId} onValueChange={setClientId} disabled={generating}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={NO_CLIENT}>Sin cliente — lluvia de ideas general</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
            Tendencias
          </Label>
          {trendsLoading ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Cargando tendencias…
            </p>
          ) : liveTrends.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No hay tendencias en vivo ahora. Escribe las tuyas abajo.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {liveTrends.map((t) => {
                const on = selectedTrends.has(t.title)
                return (
                  <button
                    key={t.title}
                    type="button"
                    disabled={generating}
                    onClick={() => toggleTrend(t.title)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    {t.title}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex gap-1.5 pt-1">
            <Input
              value={manualTrend}
              onChange={(e) => setManualTrend(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addManualTrend()
                }
              }}
              placeholder="Añade una tendencia o audio…"
              disabled={generating}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={addManualTrend}
              disabled={generating || !manualTrend.trim()}
              aria-label="Añadir tendencia"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {manualTrends.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {manualTrends.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                >
                  {t}
                  <button type="button" onClick={() => removeManualTrend(t)} aria-label={`Quitar ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
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
            placeholder="Ej: campaña de verano, behind-the-scenes, lanzamiento…"
            rows={3}
            disabled={generating}
            className="text-sm resize-none"
          />
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
          disabled={generating || selectedTypes.size === 0}
          className="w-full gap-2"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? 'Generando…' : `Generar ${count} ideas`}
        </Button>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {generating ? (
          <>
            {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="mt-3 h-3 w-full rounded bg-muted" />
                <div className="mt-2 h-3 w-5/6 rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
              </div>
            ))}
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generando {count} ideas con IA…
            </p>
          </>
        ) : ideas.length === 0 ? (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Tus ideas aparecerán aquí.</p>
            <p className="text-xs">Elige tendencias y tipos de contenido, luego genera.</p>
          </div>
        ) : (
          ideas.map((idea, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg border p-4 animate-in fade-in slide-in-from-bottom-1 duration-300 transition-opacity',
                verdicts[i] === 'approved' && 'border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/10',
                verdicts[i] === 'rejected' && 'opacity-50'
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <h3 className="min-w-0 truncate font-semibold">{idea.title}</h3>
                <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                  {idea.objective && (
                    <Badge variant="outline" className="text-[10px]">
                      {idea.objective}
                      {idea.funnel_stage ? ` · ${idea.funnel_stage}` : ''}
                    </Badge>
                  )}
                  <Badge variant="secondary">{TYPE_LABEL[idea.content_type] ?? idea.content_type}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium">{idea.hook}</p>
              <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
                <div>
                  <dt className="font-semibold text-foreground">Brief visual</dt>
                  <dd>{idea.visual_brief}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Ángulo del caption</dt>
                  <dd>{idea.caption_angle}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Por qué funciona</dt>
                  <dd>{idea.rationale}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] text-primary">{idea.hashtags_suggestion}</p>

              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                {verdicts[i] === 'approved' ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Check className="h-4 w-4" /> Aprobada — visible para el equipo
                  </span>
                ) : verdicts[i] === 'rejected' ? (
                  <span className="text-xs text-muted-foreground">Descartada</span>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-emerald-600 hover:text-emerald-700"
                      onClick={() => handleRate(idea, i, 'approved')}
                    >
                      <Check className="h-4 w-4" /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 text-muted-foreground"
                      onClick={() => handleRate(idea, i, 'rejected')}
                    >
                      <X className="h-4 w-4" /> Descartar
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
