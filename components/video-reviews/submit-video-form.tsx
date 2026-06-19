'use client'

import { useState, useTransition } from 'react'
import { submitVideoReview } from '@/lib/actions/video-reviews'
import type { Client } from '@/lib/supabase/types'
import { useToast } from '@/lib/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Film, Link2 } from 'lucide-react'
import { friendlyError } from '@/lib/utils/error-message'

interface SubmitVideoFormProps {
  open: boolean
  onClose: () => void
  clients: Pick<Client, 'id' | 'name'>[]
}

export function SubmitVideoForm({ open, onClose, clients }: SubmitVideoFormProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [driveLink, setDriveLink] = useState('')
  const [clientId, setClientId] = useState<string>('__none__')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await submitVideoReview({
        title,
        drive_link: driveLink,
        client_id: clientId === '__none__' || !clientId ? null : clientId,
        general_notes: notes || null,
      })
      if (result.error) {
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
      } else {
        toast({ title: 'Video enviado para revisión' })
        setTitle('')
        setDriveLink('')
        setClientId('__none__')
        setNotes('')
        onClose()
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Enviar Video para Revisión
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="vr-title">Título del Video *</Label>
            <Input
              id="vr-title"
              placeholder="p.ej. Cliente X — Reel de Abril v2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vr-link">Enlace de Google Drive *</Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="vr-link"
                className="pl-9"
                placeholder="https://drive.google.com/..."
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                required
                type="text"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente (opcional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin cliente</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vr-notes">Notas para el revisor (opcional)</Label>
            <Textarea
              id="vr-notes"
              placeholder="Contexto, escenas específicas a revisar, timestamps..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? 'Enviando...' : 'Enviar Video'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
