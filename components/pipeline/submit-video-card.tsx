'use client'

import { useMemo, useState } from 'react'
import { Link2, Check, AlertCircle, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { describeDriveLink } from '@/lib/utils/drive-link'

/**
 * Submit box that lives at the top of the Video column: the editor picks the
 * client the video belongs to and pastes the Google Drive link. The link is
 * validated as it's typed so a bad paste is caught here, not after a round trip.
 */

export interface SubmitVideoPayload {
  clientId: string
  driveLink: string
  driveFileId: string
  title: string
}

export function SubmitVideoCard({
  clients,
  onSubmit,
  pending = false,
}: {
  clients: { id: string; name: string }[]
  onSubmit: (payload: SubmitVideoPayload) => void
  pending?: boolean
}) {
  const [clientId, setClientId] = useState('')
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')

  const feedback = useMemo(() => describeDriveLink(link), [link])
  const canSubmit = !!clientId && feedback.state === 'valid' && !pending

  function submit() {
    if (!canSubmit || !feedback.fileId) return
    const clientName = clients.find((c) => c.id === clientId)?.name ?? 'Cliente'
    onSubmit({
      clientId,
      driveLink: link.trim(),
      driveFileId: feedback.fileId,
      // A card with no name is unreadable on the board — fall back to the client.
      title: title.trim() || `${clientName} — video sin título`,
    })
    setClientId('')
    setLink('')
    setTitle('')
  }

  return (
    <section className="space-y-2.5 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 truncate text-[12px] font-semibold tracking-tight">Enviar video editado</h3>
        <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">Editor</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sv-client" className="text-[11px]">Cliente *</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger id="sv-client" aria-label="Cliente" className="h-9">
            <SelectValue placeholder="¿De qué cliente es?" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {clients.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay clientes activos</p>
            ) : (
              clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sv-link" className="text-[11px]">Enlace de Google Drive *</Label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="sv-link"
            className={cn(
              'h-9 pl-9',
              feedback.state === 'invalid' && 'border-destructive focus-visible:ring-destructive',
            )}
            placeholder="https://drive.google.com/file/d/..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
        {feedback.message && (
          <p
            className={cn(
              'flex items-start gap-1.5 text-[11px]',
              feedback.state === 'valid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
            )}
          >
            {feedback.state === 'valid'
              ? <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              : <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            {feedback.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sv-title" className="text-[11px]">Título (opcional)</Label>
        <Input
          id="sv-title"
          className="h-9"
          placeholder="p. ej. Reel de abril v2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <Button size="sm" className="w-full" disabled={!canSubmit} onClick={submit}>
        <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Enviar a revisión
      </Button>
    </section>
  )
}
