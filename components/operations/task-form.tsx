'use client'

import { useTransition, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { taskSchema, type TaskFormValues } from '@/lib/validations/task.schema'
import { createTask, updateTask } from '@/lib/actions/tasks'
import { useToast } from '@/lib/hooks/use-toast'
import type { Client, Profile, Task } from '@/lib/supabase/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients: Pick<Client, 'id' | 'name'>[]
  teamMembers: Pick<Profile, 'id' | 'full_name' | 'email'>[]
  task?: Task
  defaultStatus?: string
}

export function TaskForm({ open, onOpenChange, clients, teamMembers, task, defaultStatus }: TaskFormProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const isEdit = !!task

  const [collaborators, setCollaborators] = useState<string[]>(task?.collaborators ?? [])

  const blankValues = {
    title: '',
    description: '',
    type: 'other' as const,
    client_id: null,
    assignee_id: null,
    status: (defaultStatus || 'pending') as 'pending' | 'in_progress' | 'completed' | 'blocked',
    due_at: null,
    priority: 2,
  }

  function toggleCollaborator(id: string) {
    setCollaborators((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])
  }

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: task ? {
      title: task.title,
      description: task.description ?? '',
      type: task.type,
      client_id: task.client_id,
      assignee_id: task.assignee_id,
      status: task.status,
      due_at: task.due_at ?? null,
      priority: task.priority,
    } : blankValues,
  })

  // Reset form when task or defaultStatus changes
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        type: task.type,
        client_id: task.client_id,
        assignee_id: task.assignee_id,
        status: task.status,
        due_at: task.due_at ?? null,
        priority: task.priority,
      })
    } else {
      form.reset(blankValues)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, defaultStatus])

  function onSubmit(values: TaskFormValues) {
    startTransition(async () => {
      const result = isEdit && task
        ? await updateTask(task.id, values, collaborators)
        : await createTask(values, collaborators)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: isEdit ? 'Tarea actualizada' : 'Tarea creada' })
      form.reset()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Descripción de la tarea..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="content_creation">Creación de Contenido</SelectItem>
                        <SelectItem value="scheduling">Programación</SelectItem>
                        <SelectItem value="reporting">Reportes</SelectItem>
                        <SelectItem value="client_call">Llamada de Cliente</SelectItem>
                        <SelectItem value="review">Revisión</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">↑ Alta</SelectItem>
                        <SelectItem value="2">→ Media</SelectItem>
                        <SelectItem value="3">↓ Baja</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                      defaultValue="none"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin cliente</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asignar a</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                      defaultValue="none"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {teamMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name || m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="due_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha Límite</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales..."
                      className="resize-none h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {teamMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Colaboradores</p>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map((m) => {
                    const selected = collaborators.includes(m.id)
                    const initials = (m.full_name || m.email || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleCollaborator(m.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                          selected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-input hover:border-primary hover:text-foreground'
                        }`}
                      >
                        <span className="h-4 w-4 rounded-full bg-current/20 inline-flex items-center justify-center text-[9px] font-bold">{initials}</span>
                        {m.full_name || m.email}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (isEdit ? 'Guardando...' : 'Creando...') : (isEdit ? 'Guardar Cambios' : 'Crear Tarea')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
