'use client'

import { useState, useTransition } from 'react'
import type { ContentIdea, ContentIdeaType, RecordingSession, Client } from '@/lib/supabase/types'
import { assignIdeaToSession, markIdeaRecorded, createContentIdeaManual } from '@/lib/actions/content-ideas'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Camera, CheckCircle2, Circle, Plus, Video, BookOpen,
  Building2, Clock, MapPin, Link2, Unlink, Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtendedSession extends RecordingSession {
  client?: Pick<Client, 'id' | 'name'> | null
}

interface SessionIdeasPanelProps {
  open: boolean
  onClose: () => void
  session: ExtendedSession
  clientIdeas: ContentIdea[]          // All ideas for this client
  onIdeasChange: (ideas: ContentIdea[]) => void
}

// ── Content type label helpers ────────────────────────────────────────────────

const typeLabel: Record<ContentIdeaType, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }
const typeColor: Record<ContentIdeaType, string> = {
  R: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  P: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  C: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  S: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
}

// ── Buffer badge ──────────────────────────────────────────────────────────────

function BufferBadge({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-muted-foreground">0 videos grabados</span>
  const color = count <= 3 ? 'bg-red-500/10 text-red-500 border-red-500/20'
    : count <= 6 ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
    : 'bg-green-500/10 text-green-600 border-green-500/20'
  return (
    <Badge variant="outline" className={cn('text-xs', color)}>
      {count} en buffer {count <= 3 ? '🔴' : count <= 6 ? '🟡' : '✅'}
    </Badge>
  )
}

// ── Add Idea inline form ──────────────────────────────────────────────────────

function AddIdeaForm({
  clientId,
  sessionId,
  onAdded,
}: {
  clientId: string
  sessionId: string
  onAdded: (idea: ContentIdea) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<ContentIdeaType>('R')
  const [hook, setHook] = useState('')
  const { toast } = useToast()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const result = await createContentIdeaManual({
        clientId,
        contentType,
        title: title.trim(),
        hook: hook.trim() || null,
      })
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
        return
      }
      if (result.idea) {
        // Auto-assign to this session
        await assignIdeaToSession(result.idea.id, sessionId)
        onAdded({ ...result.idea, recording_session_id: sessionId })
      }
      setTitle('')
      setHook('')
      toast({ title: 'Idea agregada a la sesión ✓' })
    })
  }

  return (
    <form onSubmit={handleAdd} className="rounded-lg border border-dashed border-border p-3 space-y-2 bg-muted/20">
      <p className="text-xs font-medium text-muted-foreground">Nueva idea para esta sesión</p>
      <div className="flex gap-2">
        <Select value={contentType} onValueChange={(v) => setContentType(v as ContentIdeaType)}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
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
          className="h-8 text-sm flex-1"
        />
      </div>
      <Input
        placeholder="Hook / idea principal (opcional)"
        value={hook}
        onChange={(e) => setHook(e.target.value)}
        className="h-8 text-xs"
      />
      <Button type="submit" size="sm" className="w-full h-7 text-xs gap-1.5" disabled={isPending || !title.trim()}>
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        Agregar idea
      </Button>
    </form>
  )
}

// ── Idea row ──────────────────────────────────────────────────────────────────

function IdeaRow({
  idea,
  sessionId,
  onUpdate,
}: {
  idea: ContentIdea
  sessionId: string
  onUpdate: (updated: ContentIdea) => void
}) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const isLinked = idea.recording_session_id === sessionId
  const isRecorded = idea.status === 'grabada'

  function toggleLinked() {
    startTransition(async () => {
      const result = await assignIdeaToSession(idea.id, isLinked ? null : sessionId)
      if (result.error) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
      onUpdate({ ...idea, recording_session_id: isLinked ? null : sessionId })
    })
  }

  function toggleRecorded() {
    if (!isLinked) return // Can only mark recorded if linked to this session
    startTransition(async () => {
      const result = await markIdeaRecorded(idea.id, !isRecorded)
      if (result.error) { toast({ title: 'Error', description: result.error, variant: 'destructive' }); return }
      onUpdate({ ...idea, status: isRecorded ? 'idea' : 'grabada' })
      if (!isRecorded) toast({ title: '¡Video grabado! Agregado al buffer ✓' })
    })
  }

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg border p-3 transition-colors',
      isRecorded ? 'bg-green-500/5 border-green-500/20' :
      isLinked ? 'bg-card border-border' :
      'bg-muted/30 border-dashed border-border opacity-60'
    )}>
      {/* Recorded checkbox */}
      <button
        onClick={toggleRecorded}
        disabled={isPending || !isLinked}
        className={cn(
          'mt-0.5 shrink-0 transition-colors',
          !isLinked && 'cursor-not-allowed',
          isRecorded ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecorded ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn('text-[10px]', typeColor[idea.content_type])}>
            {typeLabel[idea.content_type]}
          </Badge>
          <p className={cn('text-sm font-medium truncate', isRecorded && 'line-through text-muted-foreground')}>
            {idea.title}
          </p>
        </div>
        {idea.hook && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">"{idea.hook}"</p>
        )}
        {isRecorded && (
          <p className="text-xs text-green-600 mt-0.5 font-medium">✓ Grabado — en buffer</p>
        )}
      </div>

      {/* Link/unlink button */}
      <button
        onClick={toggleLinked}
        disabled={isPending || isRecorded}
        title={isLinked ? 'Quitar de esta sesión' : 'Agregar a esta sesión'}
        className={cn(
          'shrink-0 p-1 rounded transition-colors',
          isLinked
            ? 'text-primary hover:text-destructive'
            : 'text-muted-foreground hover:text-primary',
          isRecorded && 'cursor-not-allowed opacity-50'
        )}
      >
        {isLinked ? <Link2 className="h-3.5 w-3.5" /> : <Unlink className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function SessionIdeasPanel({ open, onClose, session, clientIdeas, onIdeasChange }: SessionIdeasPanelProps) {
  const [ideas, setIdeas] = useState<ContentIdea[]>(clientIdeas)
  const [showAddForm, setShowAddForm] = useState(false)

  const sessionIdeas = ideas.filter((i) => i.recording_session_id === session.id)
  const otherIdeas = ideas.filter((i) => !i.recording_session_id || i.recording_session_id !== session.id)
  const recordedCount = ideas.filter((i) => i.status === 'grabada').length

  function updateIdea(updated: ContentIdea) {
    const next = ideas.map((i) => i.id === updated.id ? updated : i)
    setIdeas(next)
    onIdeasChange(next)
  }

  function addIdea(idea: ContentIdea) {
    const next = [...ideas, idea]
    setIdeas(next)
    onIdeasChange(next)
    setShowAddForm(false)
  }

  const sessionDate = session.session_date
    ? format(parseISO(session.session_date), "EEEE, d 'de' MMMM yyyy", { locale: es })
    : ''

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            {session.title}
          </DialogTitle>
        </DialogHeader>

        {/* Session meta */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pb-3 border-b border-border">
          {session.client && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <Building2 className="h-3 w-3" /> {session.client.name}
            </span>
          )}
          <span className="capitalize">{sessionDate}</span>
          {session.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {session.start_time.slice(0, 5)}{session.end_time ? ` – ${session.end_time.slice(0, 5)}` : ''}
            </span>
          )}
          {session.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {session.location}
            </span>
          )}
        </div>

        {/* Buffer summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Buffer del cliente</span>
          </div>
          <BufferBadge count={recordedCount} />
        </div>

        {/* Session ideas list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ideas para esta sesión ({sessionIdeas.length})
            </Label>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Agregar idea
            </button>
          </div>

          {showAddForm && session.client_id && (
            <AddIdeaForm
              clientId={session.client_id}
              sessionId={session.id}
              onAdded={addIdea}
            />
          )}

          {sessionIdeas.length === 0 && !showAddForm ? (
            <div className="text-center py-6 text-muted-foreground rounded-lg border border-dashed">
              <BookOpen className="h-8 w-8 mx-auto opacity-20 mb-2" />
              <p className="text-xs">Sin ideas asignadas a esta sesión</p>
              <button onClick={() => setShowAddForm(true)} className="text-xs text-primary hover:underline mt-1">
                + Agregar ideas
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessionIdeas.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} sessionId={session.id} onUpdate={updateIdea} />
              ))}
            </div>
          )}
        </div>

        {/* Other client ideas (to link) */}
        {otherIdeas.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Otras ideas del cliente — agregar a sesión
            </Label>
            <div className="space-y-2">
              {otherIdeas
                .filter((i) => i.status === 'idea' || i.status === 'asignada')
                .slice(0, 8)
                .map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} sessionId={session.id} onUpdate={updateIdea} />
                ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
