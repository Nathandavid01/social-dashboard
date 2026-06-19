'use client'

import { useState, useTransition } from 'react'
import type { ContentIdea, Profile } from '@/lib/supabase/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Send, Loader2, Calendar, User } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { assignIdeaToProductionTask } from '@/lib/actions/content-ideas'
import { friendlyError } from '@/lib/utils/error-message'

interface Props {
  idea: ContentIdea
  profiles: Pick<Profile, 'id' | 'full_name'>[]
  onClose: () => void
  onAssigned: (updated: ContentIdea & { assignee?: Pick<Profile, 'id' | 'full_name'> | null }) => void
}

function defaultPublishDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function AssignToProductionModal({ idea, profiles, onClose, onAssigned }: Props) {
  const { toast } = useToast()
  const [publishDate, setPublishDate] = useState(defaultPublishDate())
  const [assignedToId, setAssignedToId] = useState<string>('unassigned')
  const [isPending, startTransition] = useTransition()

  function handleAssign() {
    startTransition(async () => {
      const result = await assignIdeaToProductionTask({
        ideaId: idea.id,
        clientId: idea.client_id,
        contentType: idea.content_type,
        publishDate,
        assignedToId: assignedToId === 'unassigned' ? null : assignedToId,
        weekStart: getMondayOfWeek(publishDate),
      })
      if (result.error) {
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
        return
      }
      toast({ title: 'Idea asignada a producción', description: 'Verás la tarea en /produccion' })
      const assignee = assignedToId === 'unassigned' ? null : profiles.find((p) => p.id === assignedToId) ?? null
      onAssigned({ ...idea, status: 'asignada', production_task_id: result.taskId ?? null, assignee })
    })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Asignar a producción
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Idea</p>
            <p className="text-sm font-medium">{idea.title}</p>
            {idea.client?.name && (
              <p className="text-xs text-muted-foreground">@ {idea.client.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Fecha de publicación
            </Label>
            <Input
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <User className="h-3 w-3" />
              Asignar a (opcional)
            </Label>
            <Select value={assignedToId} onValueChange={setAssignedToId} disabled={isPending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Sin asignar</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground">
            Se creará una tarea de producción con el brief visual de la idea como notas. Cuando se publique, esta idea se marcará como <strong>Publicada</strong> automáticamente.
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={isPending} className="flex-1 gap-2">
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Asignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
