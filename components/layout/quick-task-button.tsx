'use client'

import { useState, useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, CheckCircle2, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { createTask } from '@/lib/actions/tasks'
import { useToast } from '@/lib/hooks/use-toast'

interface Client {
  id: string
  name: string
}

const TASK_TEMPLATES = [
  { label: 'Creación de Contenido', title: 'Crear contenido para', type: 'content_creation', priority: 2 },
  { label: 'Programar Posts', title: 'Programar publicaciones para', type: 'scheduling', priority: 2 },
  { label: 'Reporte Mensual', title: 'Reporte de rendimiento mensual para', type: 'reporting', priority: 1 },
  { label: 'Llamada con Cliente', title: 'Llamada estratégica con', type: 'client_call', priority: 1 },
  { label: 'Revisión de Contenido', title: 'Revisar y aprobar contenido para', type: 'review', priority: 2 },
  { label: 'Caption de Video', title: 'Generar caption para video —', type: 'content_creation', priority: 2 },
  { label: 'Instagram Reel', title: 'Editar y publicar Reel de Instagram para', type: 'content_creation', priority: 1 },
  { label: 'Revisión de Analytics', title: 'Revisar analytics e insights para', type: 'reporting', priority: 3 },
] as const

export function QuickTaskButton() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [clients, setClients] = useState<Client[]>([])
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState<string>('')
  const [type, setType] = useState<string>('other')
  const [priority, setPriority] = useState<string>('2')
  const [dueAt, setDueAt] = useState<string>('')
  const [done, setDone] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && clients.length === 0) {
      fetch('/api/clients/list')
        .then((r) => r.json())
        .then((data) => setClients(data || []))
        .catch(() => {})
    }
  }, [open, clients.length])

  // Keyboard shortcut: ⌘N to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function reset() {
    setTitle('')
    setClientId('')
    setType('other')
    setPriority('2')
    setDueAt('')
    setDone(false)
    setShowTemplates(false)
  }

  function applyTemplate(tpl: typeof TASK_TEMPLATES[number]) {
    setTitle(tpl.title + ' ')
    setType(tpl.type)
    setPriority(String(tpl.priority))
    setShowTemplates(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      const result = await createTask({
        title: title.trim(),
        client_id: clientId || null,
        type: type as 'content_creation' | 'scheduling' | 'reporting' | 'client_call' | 'review' | 'other',
        priority: Number(priority),
        status: 'pending',
        description: undefined,
        assignee_id: null,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      })

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        setDone(true)
        toast({ title: 'Tarea creada', description: title.trim() })
        setTimeout(() => { setOpen(false); reset() }, 1200)
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
        title="Nueva Tarea (⌘N)"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Nueva Tarea</span>
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Agregar Tarea Rápida
            </DialogTitle>
          </DialogHeader>

          {done ? (
            <div className="flex flex-col items-center justify-center py-8 text-green-500 gap-2">
              <CheckCircle2 className="h-10 w-10" />
              <p className="text-sm font-medium">¡Tarea creada!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              {/* Templates */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTemplates((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Usar una plantilla
                  {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showTemplates && (
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {TASK_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="text-left text-xs px-2.5 py-2 rounded-md border border-border hover:bg-muted hover:border-primary/30 transition-colors leading-snug"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qt-title">Título de la tarea <span className="text-red-500">*</span></Label>
                <Input
                  id="qt-title"
                  autoFocus
                  placeholder="¿Qué hay que hacer?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Sin cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin cliente</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="content_creation">Contenido</SelectItem>
                      <SelectItem value="scheduling">Programación</SelectItem>
                      <SelectItem value="reporting">Reportes</SelectItem>
                      <SelectItem value="client_call">Llamada</SelectItem>
                      <SelectItem value="review">Revisión</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prioridad</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">↑ Alta</SelectItem>
                      <SelectItem value="2">→ Media</SelectItem>
                      <SelectItem value="3">↓ Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qt-due">Fecha límite</Label>
                  <input
                    id="qt-due"
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!title.trim() || isPending}>
                  {isPending ? 'Creando...' : 'Crear Tarea'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
