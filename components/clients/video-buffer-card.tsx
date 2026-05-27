'use client'

import { useState, useTransition } from 'react'
import type { ContentIdea, ContentIdeaType } from '@/lib/supabase/types'
import { createContentIdeaManual, markIdeaRecorded, deleteContentIdea } from '@/lib/actions/content-ideas'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Video, Plus, CheckCircle2, Circle, Trash2, Loader2,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const typeLabel: Record<ContentIdeaType, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }
const typeColor: Record<ContentIdeaType, string> = {
  R: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  P: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  C: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  S: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
}

function bufferColor(count: number) {
  if (count <= 3) return { border: 'border-red-500/30', badge: 'bg-red-500/10 text-red-500 border-red-500/20', icon: '🔴', label: 'Crítico' }
  if (count <= 6) return { border: 'border-yellow-500/30', badge: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: '🟡', label: 'Bajo' }
  return { border: 'border-green-500/20', badge: 'bg-green-500/10 text-green-600 border-green-500/20', icon: '✅', label: 'OK' }
}

// ── Idea row ──────────────────────────────────────────────────────────────────

function IdeaRow({
  idea,
  onUpdate,
  onDelete,
}: {
  idea: ContentIdea
  onUpdate: (updated: ContentIdea) => void
  onDelete: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const isRecorded = idea.status === 'grabada'

  function toggleRecorded() {
    startTransition(async () => {
      const result = await markIdeaRecorded(idea.id, !isRecorded)
      if (result.error) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
      onUpdate({ ...idea, status: isRecorded ? 'idea' : 'grabada' })
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteContentIdea(idea.id)
      if (result.error) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
      onDelete(idea.id)
    })
  }

  return (
    <div className={cn(
      'flex items-start gap-2 rounded-md p-2 group transition-colors',
      isRecorded ? 'bg-green-500/5' : 'hover:bg-muted/30'
    )}>
      <button
        onClick={toggleRecorded}
        disabled={isPending}
        className={cn('mt-0.5 shrink-0 transition-colors', isRecorded ? 'text-green-500' : 'text-muted-foreground hover:text-foreground')}
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isRecorded ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={cn('text-[9px] py-0', typeColor[idea.content_type])}>
            {typeLabel[idea.content_type]}
          </Badge>
          <span className={cn('text-xs truncate', isRecorded && 'line-through text-muted-foreground')}>
            {idea.title}
          </span>
        </div>
        {idea.hook && (
          <p className="text-[10px] text-muted-foreground italic mt-0.5 line-clamp-1">"{idea.hook}"</p>
        )}
        {isRecorded && <p className="text-[10px] text-green-600 mt-0.5 font-medium">En buffer</p>}
      </div>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-colors shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Add idea form ─────────────────────────────────────────────────────────────

function AddIdeaForm({ clientId, onAdded }: { clientId: string; onAdded: (idea: ContentIdea) => void }) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<ContentIdeaType>('R')
  const { toast } = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const result = await createContentIdeaManual({ clientId, contentType, title: title.trim() })
      if (result.error) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
      if (result.idea) onAdded(result.idea)
      setTitle('')
      toast({ title: 'Idea agregada ✓' })
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <Select value={contentType} onValueChange={(v) => setContentType(v as ContentIdeaType)}>
        <SelectTrigger className="h-7 w-[90px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="R">Reel</SelectItem>
          <SelectItem value="P">Post</SelectItem>
          <SelectItem value="C">Carrusel</SelectItem>
          <SelectItem value="S">Story</SelectItem>
        </SelectContent>
      </Select>
      <Input
        placeholder="Título del video..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-7 text-xs flex-1"
      />
      <Button type="submit" size="sm" className="h-7 px-3 text-xs" disabled={isPending || !title.trim()}>
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      </Button>
    </form>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface VideoBufferCardProps {
  clientId: string
  initialIdeas: ContentIdea[]
}

export function VideoBufferCard({ clientId, initialIdeas }: VideoBufferCardProps) {
  const [ideas, setIdeas] = useState<ContentIdea[]>(initialIdeas)
  const [showAdd, setShowAdd] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const bufferIdeas = ideas.filter((i) => i.status === 'grabada')
  const pendingIdeas = ideas.filter((i) => i.status === 'idea' || i.status === 'asignada')
  const bufferCount = bufferIdeas.length
  const bc = bufferColor(bufferCount)

  function updateIdea(updated: ContentIdea) {
    setIdeas((prev) => prev.map((i) => i.id === updated.id ? updated : i))
  }

  function removeIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id))
  }

  function addIdea(idea: ContentIdea) {
    setIdeas((prev) => [idea, ...prev])
    setShowAdd(false)
  }

  const visiblePending = showAll ? pendingIdeas : pendingIdeas.slice(0, 4)

  return (
    <Card className={cn('transition-colors', bc.border)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Ideas y Buffer de Video</CardTitle>
          </div>
          <Badge variant="outline" className={cn('text-xs', bc.badge)}>
            {bc.icon} {bufferCount} grabado{bufferCount !== 1 ? 's' : ''}
          </Badge>
        </div>

        {bufferCount <= 6 && (
          <div className={cn(
            'flex items-center gap-1.5 text-xs rounded-md px-2 py-1.5 mt-1',
            bufferCount <= 3
              ? 'bg-red-500/10 text-red-600'
              : 'bg-yellow-500/10 text-yellow-600'
          )}>
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {bufferCount <= 3
              ? `Buffer crítico — solo ${bufferCount} video${bufferCount !== 1 ? 's' : ''} en stock. ¡Agenda grabación pronto!`
              : `Buffer bajo — ${bufferCount} videos. Planifica la próxima sesión.`
            }
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Buffer (recorded) */}
        {bufferIdeas.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Grabados / En buffer ({bufferIdeas.length})
            </p>
            {bufferIdeas.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} onUpdate={updateIdea} onDelete={removeIdea} />
            ))}
          </div>
        )}

        {/* Pending ideas */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ideas pendientes ({pendingIdeas.length})
            </p>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>

          {showAdd && <AddIdeaForm clientId={clientId} onAdded={addIdea} />}

          {pendingIdeas.length === 0 && !showAdd ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Sin ideas pendientes —{' '}
              <button onClick={() => setShowAdd(true)} className="text-primary hover:underline">agrega una</button>
            </p>
          ) : (
            <>
              {visiblePending.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} onUpdate={updateIdea} onDelete={removeIdea} />
              ))}
              {pendingIdeas.length > 4 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                >
                  {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showAll ? 'Ver menos' : `Ver ${pendingIdeas.length - 4} más`}
                </button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
