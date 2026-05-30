'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Calendar, CalendarCheck, Film, Send, Pencil, Check, X, Loader2 } from 'lucide-react'

/** First-letter initials (max 2) from a full name, for the assignee avatar. */
function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ClientLogo } from '@/components/clients/client-logo'
import { IdeaStatusBar } from './idea-status-bar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { computeIdeaPipeline } from '@/lib/utils/idea-pipeline-stages'
import { nextAction } from '@/lib/utils/next-action'
import { updateIdeaDates, reassignVideo } from '@/lib/actions/content-ideas'
import { useToast } from '@/lib/hooks/use-toast'
import type { IdeaWithPipeline, ContentIdeaType } from '@/lib/supabase/types'

export type PersonOption = { id: string; full_name: string | null }

const TYPE_LABEL: Record<ContentIdeaType, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }
const TYPE_TONE: Record<ContentIdeaType, string> = {
  R: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  P: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  C: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  S: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
}

export type IdeaDates = { recording_date: string | null; publish_date: string | null }

function fmtDate(value: string | null): string {
  if (!value) return '—'
  // Date-only columns parse as UTC midnight; render the calendar day in local time.
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PR', { day: 'numeric', month: 'short' })
}

/** Normalise a date value to the YYYY-MM-DD form an <input type="date"> expects. */
function toInputDate(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

interface ClientGroup {
  id: string
  name: string
  logoUrl: string | null
  ideas: IdeaWithPipeline[]
}

function groupByClient(ideas: IdeaWithPipeline[]): ClientGroup[] {
  const map = new Map<string, ClientGroup>()
  for (const idea of ideas) {
    const id = idea.client_id
    if (!map.has(id)) {
      map.set(id, { id, name: idea.client?.name ?? 'Sin cliente', logoUrl: idea.client?.logo_url ?? null, ideas: [] })
    }
    map.get(id)!.ideas.push(idea)
  }
  return Array.from(map.values())
}

interface ClientIdeasRowsProps {
  ideas: IdeaWithPipeline[]
  onAssign?: (idea: IdeaWithPipeline) => void
  /** Enable bulk-select checkboxes (only assignable rows get one). */
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  /** Toggle every assignable idea in a client group at once. */
  onToggleGroup?: (ids: string[], select: boolean) => void
  /** Called after dates are persisted so the parent can update its state. */
  onDatesSaved?: (id: string, dates: IdeaDates) => void
  /** Whether the current user may assign videos (hides the Asignar button). Default true. */
  canAssign?: boolean
  /** Show a "next action" badge per video (what to do now). Default false. */
  showNextAction?: boolean
  /** People that an assigned video can be reassigned to (enables inline reassign). */
  profiles?: PersonOption[]
  /** Called after a video is reassigned so the parent can update its state. */
  onReassigned?: (id: string, assignee: PersonOption | null) => void
}

export function ClientIdeasRows({
  ideas,
  onAssign,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleGroup,
  onDatesSaved,
  canAssign = true,
  showNextAction = false,
  profiles,
  onReassigned,
}: ClientIdeasRowsProps) {
  const groups = groupByClient(ideas)

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const assignableIds = g.ideas.filter((i) => i.status === 'idea').map((i) => i.id)
        const allSelected = assignableIds.length > 0 && assignableIds.every((id) => selectedIds?.has(id))
        return (
          <section key={g.id} className="rounded-xl border bg-card animate-in fade-in duration-300">
            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {selectable && assignableIds.length > 0 && (
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => onToggleGroup?.(assignableIds, !allSelected)}
                    aria-label={`Seleccionar todos los videos de ${g.name}`}
                    className="shrink-0"
                  />
                )}
                <ClientLogo name={g.name} logoUrl={g.logoUrl} className="h-8 w-8 text-[10px]" />
                <Link href={`/clients/${g.id}`} className="truncate text-sm font-bold tracking-tight hover:text-primary">
                  {g.name}
                </Link>
              </div>
              <Badge variant="secondary" className="shrink-0 whitespace-nowrap tabular-nums">
                {g.ideas.length} {g.ideas.length === 1 ? 'video' : 'videos'}
              </Badge>
            </header>

            {g.ideas.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                <Film className="mx-auto mb-1 h-5 w-5 text-muted-foreground/50" /> Sin videos
              </div>
            ) : (
              <div className="divide-y">
                {g.ideas.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    onAssign={onAssign}
                    selectable={selectable}
                    selected={selectedIds?.has(idea.id) ?? false}
                    onToggleSelect={onToggleSelect}
                    onDatesSaved={onDatesSaved}
                    canAssign={canAssign}
                    showNextAction={showNextAction}
                    profiles={profiles}
                    onReassigned={onReassigned}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

export interface IdeaRowProps {
  idea: IdeaWithPipeline
  onAssign?: (idea: IdeaWithPipeline) => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  onDatesSaved?: (id: string, dates: IdeaDates) => void
  /** Whether the current user may assign videos (hides the Asignar button). Default true. */
  canAssign?: boolean
  /** Show a "next action" badge (what to do now). Default false. */
  showNextAction?: boolean
  profiles?: PersonOption[]
  onReassigned?: (id: string, assignee: PersonOption | null) => void
}

export function IdeaRow({ idea, onAssign, selectable, selected, onToggleSelect, onDatesSaved, canAssign = true, showNextAction = false, profiles, onReassigned }: IdeaRowProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [recording, setRecording] = useState(toInputDate(idea.recording_date))
  const [publish, setPublish] = useState(toInputDate(idea.publish_date))
  const [isPending, startTransition] = useTransition()
  const [reassigning, setReassigning] = useState(false)
  const [, startReassign] = useTransition()

  const canReassign = canAssign && !!profiles?.length && !!idea.production_task_id

  function saveReassign(value: string) {
    const newId = value || null
    startReassign(async () => {
      const res = await reassignVideo(idea.production_task_id as string, newId)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        return
      }
      const person = newId ? profiles!.find((p) => p.id === newId) ?? null : null
      onReassigned?.(idea.id, person)
      setReassigning(false)
      toast({ title: person ? `Reasignado a ${person.full_name ?? 'alguien'}` : 'Sin asignar' })
    })
  }

  const pipeline = computeIdeaPipeline({
    idea,
    videos: idea.videos,
    recordingScheduled: idea.recordingScheduled,
  })
  const typeCfg = TYPE_LABEL[idea.content_type] ?? idea.content_type
  const isAssignable = idea.status === 'idea'
  const action = nextAction(pipeline)

  function openEditor() {
    setRecording(toInputDate(idea.recording_date))
    setPublish(toInputDate(idea.publish_date))
    setEditing(true)
  }

  function saveDates() {
    const next: IdeaDates = { recording_date: recording || null, publish_date: publish || null }
    startTransition(async () => {
      const res = await updateIdeaDates(idea.id, next)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        return
      }
      onDatesSaved?.(idea.id, next)
      setEditing(false)
      toast({ title: 'Fechas actualizadas' })
    })
  }

  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {selectable && isAssignable && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect?.(idea.id)}
            aria-label={`Seleccionar ${idea.title || 'idea'}`}
            className="shrink-0"
          />
        )}
        <Badge variant="outline" className={cn('shrink-0 whitespace-nowrap text-[10px]', TYPE_TONE[idea.content_type])}>
          {typeCfg}
        </Badge>
        <Link
          href={`/produccion/idea/${idea.id}`}
          className="truncate text-sm font-medium hover:text-primary"
        >
          {idea.title || 'Sin título'}
        </Link>
        {showNextAction && (
          <span
            className={cn(
              'shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium',
              action.done
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                : 'border-primary/30 bg-primary/10 text-primary',
            )}
            title="Próxima acción"
          >
            {action.done ? '✓ ' : '→ '}{action.label}
          </span>
        )}
      </div>

      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Grabación">
            <Calendar className="h-3 w-3" />
            <input
              type="date"
              value={recording}
              onChange={(e) => setRecording(e.target.value)}
              disabled={isPending}
              className="h-7 rounded border border-input bg-background px-1.5 text-xs"
              aria-label="Fecha de grabación"
            />
          </label>
          <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Publicación">
            <CalendarCheck className="h-3 w-3" />
            <input
              type="date"
              value={publish}
              onChange={(e) => setPublish(e.target.value)}
              disabled={isPending}
              className="h-7 rounded border border-input bg-background px-1.5 text-xs"
              aria-label="Fecha de publicación"
            />
          </label>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveDates} disabled={isPending} aria-label="Guardar fechas">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditing(false)} disabled={isPending} aria-label="Cancelar">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:w-44">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="inline-flex items-center gap-1" title="Grabación">
              <Calendar className="h-3 w-3" /> {fmtDate(idea.recording_date)}
            </span>
            <span className="inline-flex items-center gap-1" title="Publicación">
              <CalendarCheck className="h-3 w-3" /> {fmtDate(idea.publish_date)}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={openEditor}
            aria-label="Editar fechas"
            title="Editar fechas"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="w-full shrink-0 sm:w-64">
        <IdeaStatusBar pipeline={pipeline} title={idea.title || undefined} ideaId={idea.id} />
      </div>

      {onAssign && isAssignable && canAssign ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAssign(idea)}
          className="h-8 shrink-0 whitespace-nowrap text-xs"
        >
          <Send className="mr-1 h-3.5 w-3.5" /> Asignar
        </Button>
      ) : idea.assignee ? (
        reassigning ? (
          <div className="flex shrink-0 items-center gap-1">
            <select
              aria-label="Reasignar persona"
              defaultValue={idea.assignee.id}
              onChange={(e) => saveReassign(e.target.value)}
              className="h-8 rounded border border-input bg-background px-1.5 text-xs"
            >
              <option value="">Sin asignar</option>
              {profiles!.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name ?? p.id}</option>
              ))}
            </select>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setReassigning(false)} aria-label="Cancelar">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : canReassign ? (
          <button
            type="button"
            onClick={() => setReassigning(true)}
            aria-label={`Reasignar ${idea.assignee.full_name ?? 'persona'}`}
            title="Reasignar"
            className="flex shrink-0 items-center gap-1.5 rounded-full px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={idea.assignee.avatar_url ?? undefined} alt={idea.assignee.full_name ?? ''} />
              <AvatarFallback className="bg-primary/15 text-[9px] font-semibold text-primary">
                {initials(idea.assignee.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[100px] truncate sm:inline">{idea.assignee.full_name ?? 'Asignado'}</span>
          </button>
        ) : (
          <span
            className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
            title={`Asignado a ${idea.assignee.full_name ?? 'alguien'}`}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={idea.assignee.avatar_url ?? undefined} alt={idea.assignee.full_name ?? ''} />
              <AvatarFallback className="bg-primary/15 text-[9px] font-semibold text-primary">
                {initials(idea.assignee.full_name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[100px] truncate sm:inline">{idea.assignee.full_name ?? 'Asignado'}</span>
          </span>
        )
      ) : null}
    </div>
  )
}
