'use client'

import { useState } from 'react'
import type { ProductionTask, ProductionTaskStatus, Profile } from '@/lib/supabase/types'
import { updateTaskStatus, updateTaskNotes } from '@/lib/actions/production'
import { StatusBadge } from './status-badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, RotateCcw, FileText, ChevronDown, ChevronUp, Send } from 'lucide-react'

interface Props {
  tasks: ProductionTask[]
}

function ReviewCard({ task: initialTask }: { task: ProductionTask }) {
  const [task, setTask] = useState(initialTask)
  const [expanded, setExpanded] = useState(false)
  const [reviewNotes, setReviewNotes] = useState(task.review_notes ?? '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [saving, setSaving] = useState(false)

  const approve = async () => {
    setSaving(true)
    await updateTaskStatus(task.id, 'aprobado')
    setTask(t => ({ ...t, status: 'aprobado' }))
    setSaving(false)
  }

  const sendBack = async () => {
    setSaving(true)
    await updateTaskStatus(task.id, 'revisiones')
    setTask(t => ({ ...t, status: 'revisiones' }))
    setSaving(false)
  }

  const markPublished = async () => {
    setSaving(true)
    await updateTaskStatus(task.id, 'publicado')
    setTask(t => ({ ...t, status: 'publicado' }))
    setSaving(false)
  }

  const saveNotes = async () => {
    await updateTaskNotes(task.id, task.notes ?? '', reviewNotes)
    setTask(t => ({ ...t, review_notes: reviewNotes }))
    setEditingNotes(false)
  }

  const isDeadlineSoon = task.deadline && new Date(task.deadline) <= new Date(Date.now() + 86400000 * 2)
  const isApproved = task.status === 'aprobado'
  const isPublished = task.status === 'publicado'

  return (
    <div className={cn(
      'rounded-xl border bg-card transition-all',
      isApproved && 'border-emerald-200 dark:border-emerald-900/40 opacity-70',
      isDeadlineSoon && !isApproved && 'border-orange-200 dark:border-orange-900/40',
    )}>
      <div className="flex items-start gap-3 p-3">
        {/* Content type */}
        <div className={cn(
          'shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-bold text-center min-w-[48px]',
          task.content_type === 'R'
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
            : 'bg-zinc-900 text-yellow-300'
        )}>
          {task.content_type === 'R' ? 'Reel' : 'Post'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold leading-tight">{task.client?.name ?? '—'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(task.publish_date + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
                {task.assigned_to && ` · ${task.assigned_to.full_name}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusBadge status={task.status as ProductionTaskStatus} size="xs" />
              {isDeadlineSoon && !isApproved && (
                <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">
                  ⏰ urgente
                </span>
              )}
            </div>
          </div>

          {/* Editor notes preview */}
          {task.notes && (
            <p className="text-xs text-muted-foreground mt-1.5 bg-muted/40 rounded-md px-2 py-1 line-clamp-1">
              📝 {task.notes}
            </p>
          )}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Action buttons */}
      {!isPublished && (
        <div className="flex items-center gap-2 px-3 pb-3">
          {!isApproved && (
            <>
              <button
                onClick={approve}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 font-medium"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Aprobar
              </button>
              <button
                onClick={sendBack}
                disabled={saving || task.status === 'revisiones'}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-40 font-medium"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Devolver
              </button>
              <button
                onClick={() => setExpanded(true)}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Notas
              </button>
            </>
          )}
          {isApproved && (
            <button
              onClick={markPublished}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Send className="h-3.5 w-3.5" />
              Marcar como publicado
            </button>
          )}
        </div>
      )}

      {/* Expanded: full notes + review notes */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
          {task.notes && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notas del editor</p>
              <p className="text-xs bg-muted/40 rounded-md px-2 py-1.5 whitespace-pre-line">{task.notes}</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notas de revisión</p>
            {editingNotes ? (
              <div className="space-y-1.5">
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Describe los cambios requeridos..."
                  className="w-full text-xs rounded-md border border-border bg-muted/40 px-2 py-1.5 resize-none outline-none focus:border-primary/50"
                />
                <div className="flex gap-1.5">
                  <button onClick={saveNotes} className="text-xs px-2.5 py-1 rounded bg-primary text-primary-foreground">
                    Guardar
                  </button>
                  <button onClick={() => { setReviewNotes(task.review_notes ?? ''); setEditingNotes(false) }} className="text-xs px-2 py-1 rounded border border-border">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingNotes(true)}
                className="w-full text-left text-xs bg-muted/40 rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                {reviewNotes || <span className="italic">Agregar notas de revisión...</span>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ReviewQueue({ tasks: initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks)

  const inRevision = tasks.filter(t => t.status === 'en_revision')
  const needsChanges = tasks.filter(t => t.status === 'revisiones')
  const approved = tasks.filter(t => t.status === 'aprobado')
  const [showApproved, setShowApproved] = useState(false)

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
        <CheckCircle2 className="mx-auto h-10 w-10 opacity-20 mb-3" />
        <p className="text-sm font-medium">No hay piezas pendientes de revisión</p>
        <p className="text-xs mt-1">Todo está aprobado o en producción</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="font-medium">{inRevision.length} en revisión</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          <span className="font-medium">{needsChanges.length} necesitan cambios</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-medium">{approved.length} aprobados hoy</span>
        </div>
      </div>

      {/* Needs changes first (urgent) */}
      {needsChanges.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
            Necesitan cambios — devueltos al editor ({needsChanges.length})
          </h3>
          {needsChanges.map(t => <ReviewCard key={t.id} task={t} />)}
        </div>
      )}

      {/* Awaiting review */}
      {inRevision.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Esperando revisión ({inRevision.length})
          </h3>
          {inRevision.map(t => <ReviewCard key={t.id} task={t} />)}
        </div>
      )}

      {/* Already approved */}
      {approved.length > 0 && (
        <div>
          <button
            onClick={() => setShowApproved(v => !v)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {approved.length} aprobados recientemente
            {showApproved ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showApproved && (
            <div className="space-y-2">
              {approved.map(t => <ReviewCard key={t.id} task={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
