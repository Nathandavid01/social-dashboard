'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { updateIdeaStatus } from '@/lib/actions/content-ideas'
import { IdeaDetailSheet } from './idea-detail-sheet'
import { cn, formatDate } from '@/lib/utils'
import type { ContentIdea, ContentIdeaStatus } from '@/lib/supabase/types'

/** Board columns map 1:1 to content_ideas.status (descartada is filtered out). */
export type StageKey = Exclude<ContentIdeaStatus, 'descartada'>

export const COLUMNS: { key: StageKey; label: string }[] = [
  { key: 'idea', label: 'Idea' },
  { key: 'asignada', label: 'Asignada' },
  { key: 'grabada', label: 'Grabada' },
  { key: 'producida', label: 'Producida' },
  { key: 'publicada', label: 'Publicada' },
]
const STAGE_KEYS = COLUMNS.map((c) => c.key) as StageKey[]

const TYPE_LABEL: Record<string, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

/** Days without activity (updated_at) after which a non-published video is flagged stale. */
export const STALE_DAYS = 7

/** The column a video belongs in — now simply its status (1:1 with the workflow). */
export function currentStage(idea: ContentIdea): StageKey {
  return STAGE_KEYS.includes(idea.status as StageKey) ? (idea.status as StageKey) : 'idea'
}

/**
 * A non-published video is overdue when EITHER its publish_date is in the past,
 * OR it has gone STALE_DAYS without activity (updated_at).
 */
export function isOverdue(idea: ContentIdea, now: Date = new Date()): boolean {
  if (idea.status === 'publicada') return false
  if (idea.publish_date) {
    const pd = new Date(`${idea.publish_date}T23:59:59`)
    if (!Number.isNaN(pd.getTime()) && pd.getTime() < now.getTime()) return true
  }
  if (idea.updated_at) {
    const u = new Date(idea.updated_at)
    if (!Number.isNaN(u.getTime()) && now.getTime() - u.getTime() > STALE_DAYS * 86_400_000) return true
  }
  return false
}

export interface DropResolution {
  ideaId: string
  targetStatus: StageKey
  /** Moving to publicada is a weighty action (sets published_at, counts to quota). */
  needsConfirm: boolean
}

/** Pure drag-end resolver: which idea moves to which status, or null for a no-op. */
export function resolveDrop(
  ideas: ContentIdea[],
  activeId: string | number | null | undefined,
  overId: string | number | null | undefined,
): DropResolution | null {
  if (overId == null || activeId == null) return null
  const target = String(overId) as StageKey
  if (!STAGE_KEYS.includes(target)) return null
  const idea = ideas.find((i) => i.id === String(activeId))
  if (!idea || idea.status === target) return null
  return { ideaId: idea.id, targetStatus: target, needsConfirm: target === 'publicada' }
}

/** Per-client production flow as an interactive Kanban — one column per status. */
export function PipelineFlowBoard({
  ideas,
  canMove = false,
}: {
  ideas: ContentIdea[]
  /** Whether the current user may drag cards (planning.move). Read-only otherwise. */
  canMove?: boolean
}) {
  const [items, setItems] = useState<ContentIdea[]>(ideas.filter((i) => i.status !== 'descartada'))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, setPending] = useState<DropResolution | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const { toast } = useToast()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sin videos en el pipeline todavía.
        </CardContent>
      </Card>
    )
  }

  const now = new Date()
  const byStage: Record<StageKey, ContentIdea[]> = { idea: [], asignada: [], grabada: [], producida: [], publicada: [] }
  for (const idea of items) byStage[currentStage(idea)].push(idea)

  function applyMove(ideaId: string, targetStatus: StageKey) {
    const prev = items
    setItems((cur) => cur.map((i) => (i.id === ideaId ? { ...i, status: targetStatus } : i)))
    startTransition(async () => {
      const res = await updateIdeaStatus(ideaId, targetStatus)
      if (res?.error) {
        setItems(prev) // rollback
        toast({ title: 'No se pudo mover', description: res.error, variant: 'destructive' })
      }
    })
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const resolution = resolveDrop(items, e.active.id, e.over?.id)
    if (!resolution) return
    if (resolution.needsConfirm) setPending(resolution)
    else applyMove(resolution.ideaId, resolution.targetStatus)
  }

  const activeIdea = activeId ? items.find((i) => i.id === activeId) ?? null : null

  const board = (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[760px] gap-3">
        {COLUMNS.map((col) => (
          <BoardColumn
            key={col.key}
            stage={col.key}
            label={col.label}
            cards={byStage[col.key]}
            now={now}
            canMove={canMove}
            onOpen={setSelectedId}
          />
        ))}
      </div>
    </div>
  )

  return (
    <>
      {canMove ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {board}
          <DragOverlay>{activeIdea ? <FlowCardInner idea={activeIdea} overdue={false} dragging /> : null}</DragOverlay>
        </DndContext>
      ) : (
        board
      )}

      <IdeaDetailSheet
        ideaId={selectedId}
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />

      <Dialog open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Marcar como publicada?</DialogTitle>
            <DialogDescription>
              Esto registra la fecha de publicación y cuenta para la cuota de la semana. Solo confírmalo si el video ya
              está publicado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pending) applyMove(pending.ideaId, pending.targetStatus)
                setPending(null)
              }}
            >
              Sí, publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BoardColumn({
  stage,
  label,
  cards,
  now,
  canMove,
  onOpen,
}: {
  stage: StageKey
  label: string
  cards: ContentIdea[]
  now: Date
  canMove: boolean
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !canMove })
  const overdueCount = cards.filter((i) => isOverdue(i, now)).length

  return (
    <div className="min-w-[148px] flex-1">
      <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="truncate">{label}</span>
        <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
          {overdueCount > 0 && (
            <AlertTriangle className="h-3 w-3 text-amber-500" aria-label={`${overdueCount} atrasado`} />
          )}
          {cards.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        data-stage={stage}
        className={cn(
          'min-h-[56px] space-y-2 rounded-lg bg-muted/30 p-2 transition-colors',
          isOver && 'bg-primary/10 ring-1 ring-primary/40',
        )}
      >
        {cards.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-muted-foreground/50">·</p>
        ) : (
          cards.map((idea) => (
            <FlowCard key={idea.id} idea={idea} overdue={isOverdue(idea, now)} canMove={canMove} onOpen={onOpen} />
          ))
        )}
      </div>
    </div>
  )
}

function FlowCard({
  idea,
  overdue,
  canMove,
  onOpen,
}: {
  idea: ContentIdea
  overdue: boolean
  canMove: boolean
  onOpen: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idea.id, disabled: !canMove })
  return (
    <button
      type="button"
      ref={setNodeRef}
      onClick={() => onOpen(idea.id)}
      className={cn('w-full text-left', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <FlowCardInner idea={idea} overdue={overdue} />
    </button>
  )
}

function FlowCardInner({ idea, overdue, dragging }: { idea: ContentIdea; overdue: boolean; dragging?: boolean }) {
  const dateStr = idea.publish_date ?? idea.created_at
  return (
    <div
      className={cn(
        'rounded-md border bg-background p-2 transition-colors hover:border-primary hover:bg-accent',
        overdue && 'border-amber-500/50 bg-amber-500/5',
        dragging && 'shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="line-clamp-2 text-xs font-medium">{idea.title}</span>
        {overdue && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-label="atrasado" />}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1 py-0.5">{TYPE_LABEL[idea.content_type] ?? idea.content_type}</span>
        {dateStr && <span className="tabular-nums">{formatDate(dateStr)}</span>}
      </div>
    </div>
  )
}
