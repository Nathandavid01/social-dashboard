'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Clock,
  Send,
  Trash2,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  MessageSquare,
  Copy,
} from 'lucide-react'
import type { Task, Profile } from '@/lib/supabase/types'
import { updateTaskStatus, updateTask, deleteTask, duplicateTask } from '@/lib/actions/tasks'
import { getTaskComments, addTaskComment, deleteTaskComment } from '@/lib/actions/task-comments'
import { useToast } from '@/lib/hooks/use-toast'
import { TaskStatusBadge } from './task-status-badge'
import { cn, formatDueDate } from '@/lib/utils'
import { format } from 'date-fns'

const taskTypeLabels: Record<string, string> = {
  content_creation: 'Creación de Contenido',
  scheduling: 'Programación',
  reporting: 'Reporte',
  client_call: 'Llamada con Cliente',
  review: 'Revisión',
  other: 'Otro',
}

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Alta', color: 'text-red-500' },
  2: { label: 'Media', color: 'text-yellow-500' },
  3: { label: 'Baja', color: 'text-muted-foreground' },
}

interface Comment {
  id: string
  content: string
  created_at: string
  author: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface TaskDetailSheetProps {
  task: Task | null
  open: boolean
  onClose: () => void
  onTaskUpdated?: () => void
  teamMembers?: Pick<Profile, 'id' | 'full_name'>[]
}

export function TaskDetailSheet({ task, open, onClose, onTaskUpdated, teamMembers = [] }: TaskDetailSheetProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [editingDue, setEditingDue] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const commentEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (task && open) {
      setLoadingComments(true)
      getTaskComments(task.id).then(({ comments: data }) => {
        setComments(data as Comment[])
        setLoadingComments(false)
      })
    }
  }, [task?.id, open])

  useEffect(() => {
    if (comments.length) {
      commentEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length])

  if (!task) return null

  const dueInfo = task.due_at ? formatDueDate(task.due_at) : null
  const priority = priorityLabels[task.priority] ?? priorityLabels[2]

  function handleStatusChange(status: string) {
    startTransition(async () => {
      const result = await updateTaskStatus(task!.id, status)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        onTaskUpdated?.()
      }
    })
  }

  function handleTitleSave() {
    if (!titleDraft.trim() || titleDraft.trim() === task!.title) {
      setEditingTitle(false)
      return
    }
    setEditingTitle(false)
    startTransition(async () => {
      const result = await updateTask(task!.id, { title: titleDraft.trim() })
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        onTaskUpdated?.()
      }
    })
  }

  function handleDueSave(value: string) {
    setEditingDue(false)
    if (!value) return
    startTransition(async () => {
      const result = await updateTask(task!.id, { due_at: new Date(value).toISOString() })
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        onTaskUpdated?.()
      }
    })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar esta tarea?')) return
    startTransition(async () => {
      const result = await deleteTask(task!.id)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        onClose()
        onTaskUpdated?.()
      }
    })
  }

  async function handleAddComment() {
    if (!newComment.trim()) return
    const draft = newComment
    setNewComment('')
    const result = await addTaskComment(task!.id, draft)
    if (result.error) {
      setNewComment(draft)
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } else {
      const { comments: updated } = await getTaskComments(task!.id)
      setComments(updated as Comment[])
    }
  }

  async function handleDeleteComment(commentId: string) {
    const result = await deleteTaskComment(commentId)
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' })
    } else {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-3">
            <button
              onClick={() => task.status !== 'completed' && handleStatusChange('completed')}
              disabled={isPending}
              title={task.status === 'completed' ? 'Completada' : 'Marcar completa'}
              className={cn(
                'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 transition-colors flex items-center justify-center',
                task.status === 'completed'
                  ? 'border-green-500 bg-green-500/20 text-green-500'
                  : 'border-muted-foreground/30 hover:border-green-500 hover:bg-green-500/10'
              )}
            >
              {task.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
            </button>
            <div className="flex-1 min-w-0">
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave()
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  className="w-full text-base font-semibold bg-transparent border-b border-primary focus:outline-none pb-0.5"
                />
              ) : (
                <SheetTitle
                  className="text-base font-semibold leading-snug cursor-pointer hover:text-primary transition-colors"
                  onClick={() => { setTitleDraft(task.title); setEditingTitle(true) }}
                >
                  {task.title}
                </SheetTitle>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <TaskStatusBadge status={task.status} />
                <Badge variant="outline" className="text-[10px]">
                  {taskTypeLabels[task.type] ?? task.type}
                </Badge>
                {task.client && (
                  <span className="text-xs text-muted-foreground">
                    @ {(task.client as { name: string }).name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Meta row */}
          <div className="px-6 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Priority */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Prioridad</p>
                <Select
                  value={String(task.priority)}
                  onValueChange={(v) => {
                    startTransition(async () => {
                      const result = await updateTask(task!.id, { priority: Number(v) as 1 | 2 | 3 })
                      if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
                      else onTaskUpdated?.()
                    })
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1"><span className="text-red-500 font-medium">↑ Alta</span></SelectItem>
                    <SelectItem value="2"><span className="text-yellow-500 font-medium">→ Media</span></SelectItem>
                    <SelectItem value="3"><span className="text-muted-foreground">↓ Baja</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Due date */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Fecha límite</p>
                {editingDue ? (
                  <input
                    type="datetime-local"
                    defaultValue={task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : ''}
                    autoFocus
                    className="text-xs border rounded px-1.5 py-0.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full"
                    onBlur={(e) => handleDueSave(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDueSave((e.target as HTMLInputElement).value)
                      if (e.key === 'Escape') setEditingDue(false)
                    }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingDue(true)}
                    className={cn(
                      'flex items-center gap-1 text-sm hover:text-primary transition-colors',
                      dueInfo?.isOverdue && task.status !== 'completed' ? 'text-red-500 font-semibold' :
                      dueInfo?.isDueToday && task.status !== 'completed' ? 'text-yellow-500 font-medium' :
                      'text-muted-foreground'
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {dueInfo ? dueInfo.label : 'Sin fecha'}
                  </button>
                )}
              </div>

              {/* Assignee */}
              {teamMembers.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Asignado a</p>
                  <Select
                    value={task.assignee_id ?? 'unassigned'}
                    onValueChange={(v) => {
                      startTransition(async () => {
                        const result = await updateTask(task!.id, { assignee_id: v === 'unassigned' ? null : v })
                        if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
                        else onTaskUpdated?.()
                      })
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Sin asignar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sin asignar</SelectItem>
                      {teamMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : task.assignee ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Asignado a</p>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {task.assignee.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{task.assignee.full_name}</span>
                  </div>
                </div>
              ) : null}

              {/* Created */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Creada</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(task.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            {/* Collaborators */}
            {teamMembers.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Colaboradores</p>
                <div className="flex flex-wrap gap-1.5">
                  {teamMembers.filter((m) => m.id !== task.assignee_id).map((m) => {
                    const isCollab = (task.collaborators as string[] ?? []).includes(m.id)
                    const initials = (m.full_name ?? '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <button
                        key={m.id}
                        disabled={isPending}
                        onClick={() => {
                          const current = (task.collaborators as string[]) ?? []
                          const next = isCollab ? current.filter((id) => id !== m.id) : [...current, m.id]
                          startTransition(async () => {
                            await updateTask(task!.id, {}, next)
                            onTaskUpdated?.()
                          })
                        }}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors',
                          isCollab
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-input text-muted-foreground hover:border-primary hover:text-foreground'
                        )}
                      >
                        <span className="font-semibold">{initials}</span>
                        <span>{m.full_name?.split(' ')[0]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Status quick-change */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Estado</p>
              <Select value={task.status} onValueChange={handleStatusChange} disabled={isPending}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En progreso</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="blocked">Bloqueada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Descripción</p>
              {editingDesc ? (
                <div className="space-y-1.5">
                  <Textarea
                    autoFocus
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={4}
                    className="text-sm resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditingDesc(false)
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingDesc(false)
                        if (descDraft === (task.description ?? '')) return
                        startTransition(async () => {
                          const result = await updateTask(task!.id, { description: descDraft || undefined })
                          if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' })
                          else onTaskUpdated?.()
                        })
                      }}
                      disabled={isPending}
                    >
                      Guardar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setDescDraft(task.description ?? ''); setEditingDesc(true) }}
                  className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground bg-muted/30 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors min-h-[2.5rem]"
                >
                  {task.description || <span className="italic opacity-50">Click para agregar descripción...</span>}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              {task.status !== 'in_progress' && task.status !== 'completed' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('in_progress')} disabled={isPending}>
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                  Iniciar
                </Button>
              )}
              {task.status !== 'completed' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('completed')} disabled={isPending}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-green-500" />
                  Completar
                </Button>
              )}
              {task.status !== 'blocked' && task.status !== 'completed' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('blocked')} disabled={isPending}>
                  <AlertCircle className="mr-1.5 h-3.5 w-3.5 text-orange-500" />
                  Bloquear
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                title="Duplicar tarea"
                onClick={() => {
                  startTransition(async () => {
                    const result = await duplicateTask(task!.id)
                    if (result.error) {
                      toast({ title: 'Error', description: result.error, variant: 'destructive' })
                    } else {
                      toast({ title: 'Tarea duplicada', description: 'Aparece en el board como pendiente.' })
                      onTaskUpdated?.()
                    }
                  })
                }}
                disabled={isPending}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Comments */}
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">
                Comentarios{comments.length > 0 ? ` (${comments.length})` : ''}
              </p>
            </div>

            {loadingComments ? (
              <p className="text-xs text-muted-foreground">Cargando comentarios...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin comentarios aún. Sé el primero.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => {
                  const initials = comment.author?.full_name
                    ? comment.author.full_name.split(' ').map((n) => n[0]).join('').toUpperCase()
                    : '?'
                  return (
                    <div key={comment.id} className="flex gap-2.5 group">
                      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 bg-muted/40 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium">{comment.author?.full_name ?? 'Usuario'}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                          </span>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={commentEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Comment input */}
        <div className="border-t px-6 py-4 shrink-0">
          <div className="flex gap-2">
            <Textarea
              placeholder="Agregar comentario..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              className="text-sm resize-none flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleAddComment()
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="shrink-0 self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">⌘+Enter para enviar</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
