'use client'

import { useState, useTransition } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile } from '@/lib/actions/client-profile'

interface Props {
  clientId: string
  initialAt: string | null
  initialNotes: string | null
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  // Convert to local datetime-local format YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function LastMeetingEditor({ clientId, initialAt, initialNotes }: Props) {
  const [at, setAt] = useState(toDatetimeLocal(initialAt))
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const initialAtLocal = toDatetimeLocal(initialAt)
  const dirty = at !== initialAtLocal || notes !== (initialNotes ?? '')

  function save() {
    startTransition(async () => {
      const res = await updateClientProfile(clientId, {
        last_meeting_at: at ? new Date(at).toISOString() : null,
        last_meeting_notes: notes || null,
      })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Meeting actualizado' })
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="meeting_at" className="text-xs">Fecha y hora</Label>
        <Input
          id="meeting_at"
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="meeting_notes" className="text-xs">Notas</Label>
        <Textarea
          id="meeting_notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Acuerdos, action items, contexto…"
          className="resize-none"
        />
      </div>
      <Button onClick={save} disabled={!dirty || isPending} size="sm" className="w-full">
        {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
        Guardar
      </Button>
    </div>
  )
}
