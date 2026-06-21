'use client'

import { useState, useTransition } from 'react'
import { StatusBadge } from './status-badge'
import { updateTaskStatus, updateTaskNotes, reassignTask, deleteProductionTask } from '@/lib/actions/production'
import type { ProductionTask, ProductionTaskStatus, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { friendlyError } from '@/lib/utils/error-message'
import { ChevronDown, Trash2, FileText } from 'lucide-react'

const STATUS_FLOW: ProductionTaskStatus[] = ['pendiente', 'en_edicion', 'en_revision', 'revisiones', 'aprobado', 'publicado']
const STATUS_LABEL: Record<ProductionTaskStatus, string> = {
  pendiente: 'Pendiente',
  en_edicion: 'En Edición',
  en_revision: 'En Revisión',
  revisiones: 'Cambios',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
}
const CONTENT_TYPE_LABEL: Record<string, string> = { R: 'Reel', P: 'Post' }

interface Props {
  task: ProductionTask
  profiles?: Pick<Profile, 'id' | 'full_name'>[]
  showClient?: boolean
  onUpdate?: () => void
}

export function ProductionTaskCard({ task, profiles = [], showClient = true, onUpdate }: Props) {
  const [status, setStatus] = useState(task.status)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, startDelete] = useTransition()
  const { toast } = useToast()

  const currentIdx = STATUS_FLOW.indexOf(status)

  const advance = async () => {
    if (currentIdx >= STATUS_FLOW.length - 1) return
    const next = STATUS_FLOW[currentIdx + 1]
    setSaving(true)
    await updateTaskStatus(task.id, next)
    setStatus(next)
    setSaving(false)
    onUpdate?.()
  }

  const goBack = async (s: ProductionTaskStatus) => {
    setSaving(true)
    await updateTaskStatus(task.id, s)
    setStatus(s)
    setSaving(false)
    onUpdate?.()
  }

  const saveNotes = async () => {
    await updateTaskNotes(task.id, notes)
    setEditingNotes(false)
    onUpdate?.()
  }

  const del = () => {
    startDelete(async () => {
      const res = await deleteProductionTask(task.id)
      if (res?.error) {
        toast({ title: 'Error', description: friendlyError(res.error), variant: 'destructive' })
        return
      }
      toast({ title: 'Tarea eliminada' })
      setConfirmOpen(false)
      onUpdate?.()
    })
  }

  const publishDate = new Date(task.publish_date + 'T12:00:00')
  const dayName = publishDate.toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className={cn(
      'rounded-xl border bg-card transition-all',
      status === 'publicado' && 'opacity-60',
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 p-3">
        {/* Content type pill */}
        <div className={cn(
          'shrink-0 rounded-md px-2 py-1 text-xs font-bold',
          task.content_type === 'R'
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
            : 'bg-zinc-900 text-yellow-300 dark:bg-zinc-700'
        )}>
          {CONTENT_TYPE_LABEL[task.content_type]}
        </div>

        <div className="flex-1 min-w-0">
          {showClient && (
            <p className="text-sm font-semibold text-foreground leading-tight truncate">
              {task.client?.name ?? '—'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{dayName}</p>
          {task.assigned_to && (
            <p className="text-xs text-muted-foreground mt-0.5">
              → {task.assigned_to.full_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={status} size="xs" />
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          {/* Status timeline */}
          <div className="flex gap-1 flex-wrap">
            {STATUS_FLOW.map((s, i) => (
              <button
                key={s}
                disabled={saving}
                onClick={() => i !== currentIdx && goBack(s)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  i === currentIdx
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : i < currentIdx
                    ? 'bg-muted/60 text-muted-foreground border-border'
                    : 'bg-transparent text-muted-foreground border-dashed border-muted-foreground/40 hover:border-primary/50'
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Notes */}
          {editingNotes ? (
            <div className="space-y-1">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="w-full text-xs rounded-md border border-border bg-muted/40 px-2 py-1.5 resize-none outline-none focus:border-primary/50"
                placeholder="Notas..."
                autoFocus
              />
              <div className="flex gap-1.5">
                <button onClick={saveNotes} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">Guardar</button>
                <button onClick={() => { setNotes(task.notes ?? ''); setEditingNotes(false) }} className="text-xs px-2 py-1 rounded border border-border">Cancelar</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
              <FileText className="h-3 w-3" />
              {notes || <span className="italic">Agregar notas...</span>}
            </button>
          )}

          {/* Reassign */}
          {profiles.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Asignado a</p>
              <select
                defaultValue={task.assigned_to_id ?? ''}
                onChange={async e => {
                  await reassignTask(task.id, e.target.value || null)
                  onUpdate?.()
                }}
                className="text-xs w-full rounded-md border border-border bg-card px-2 py-1"
              >
                <option value="">Sin asignar</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            {currentIdx < STATUS_FLOW.length - 1 && (
              <button
                onClick={advance}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                → {STATUS_LABEL[STATUS_FLOW[currentIdx + 1]]}
              </button>
            )}
            <button
              onClick={() => setConfirmOpen(true)}
              className="ml-auto p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
              title="Eliminar"
              aria-label="Eliminar tarea"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar tarea"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        loading={deleting}
        onConfirm={del}
      />
    </div>
  )
}
