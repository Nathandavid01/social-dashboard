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
 * Submit box at the top of the Editado column. The editor says how many videos
 * of a client are going to review, gets exactly that many Drive boxes, and each
 * link is validated as it's pasted — including a duplicate check, since pasting
 * the same file twice is the easy mistake when filling several rows at once.
 */

/** Sanity cap: a batch bigger than this is a sign something went wrong. */
export const MAX_VIDEOS_PER_SUBMIT = 10

export interface SubmitVideoItem {
  driveLink: string
  driveFileId: string
  title: string
}

export interface SubmitVideoPayload {
  clientId: string
  videos: SubmitVideoItem[]
}

interface Row {
  link: string
  title: string
}

const emptyRow = (): Row => ({ link: '', title: '' })

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
  const [rows, setRows] = useState<Row[]>([emptyRow()])

  const clientName = clients.find((c) => c.id === clientId)?.name ?? 'Cliente'

  /** Per-row link state, plus a duplicate flag against earlier rows. */
  const checks = useMemo(() => {
    const seen = new Map<string, number>()
    return rows.map((r, i) => {
      const fb = describeDriveLink(r.link)
      let duplicate = false
      if (fb.state === 'valid' && fb.fileId) {
        const first = seen.get(fb.fileId)
        if (first !== undefined && first < i) duplicate = true
        else seen.set(fb.fileId, i)
      }
      return { ...fb, duplicate }
    })
  }, [rows])

  const readyCount = checks.filter((c) => c.state === 'valid' && !c.duplicate).length
  const canSubmit = !!clientId && readyCount === rows.length && !pending

  function setCount(raw: string) {
    const n = Number.parseInt(raw, 10)
    if (Number.isNaN(n)) return
    const next = Math.min(Math.max(n, 1), MAX_VIDEOS_PER_SUBMIT)
    setRows((prev) =>
      next <= prev.length
        ? prev.slice(0, next)                                  // shrink: drop the tail
        : [...prev, ...Array.from({ length: next - prev.length }, emptyRow)], // grow: keep what's typed
    )
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function submit() {
    if (!canSubmit) return
    onSubmit({
      clientId,
      videos: rows.map((r, i) => ({
        driveLink: r.link.trim(),
        driveFileId: checks[i].fileId!,
        // A card with no name is unreadable on the board — fall back to client + position.
        title: r.title.trim() || `${clientName} — video ${i + 1}`,
      })),
    })
    setClientId('')
    setRows([emptyRow()])
  }

  return (
    <section className="space-y-2.5 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 truncate text-[12px] font-semibold tracking-tight">Enviar videos editados</h3>
        <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">Editor</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sv-client" className="text-[11px]">Cliente *</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger id="sv-client" aria-label="Cliente" className="h-9">
            <SelectValue placeholder="¿De qué cliente son?" />
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
        <Label htmlFor="sv-count" className="text-[11px]">¿Cuántos videos? *</Label>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Input
            id="sv-count"
            type="number"
            min={1}
            max={MAX_VIDEOS_PER_SUBMIT}
            value={rows.length}
            onChange={(e) => setCount(e.target.value)}
            className="h-9 w-20 shrink-0"
          />
          <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
            {readyCount} de {rows.length} listos
          </span>
        </div>
      </div>

      <ol className="space-y-2.5">
        {rows.map((row, i) => {
          const c = checks[i]
          const bad = c.state === 'invalid' || c.duplicate
          return (
            <li key={i} className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
              <p className="text-[11px] font-medium text-muted-foreground">Video {i + 1}</p>

              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label={`Enlace de Google Drive del video ${i + 1}`}
                  className={cn('h-9 pl-9', bad && 'border-destructive focus-visible:ring-destructive')}
                  placeholder="https://drive.google.com/file/d/..."
                  value={row.link}
                  onChange={(e) => setRow(i, { link: e.target.value })}
                />
              </div>

              {(c.message || c.duplicate) && (
                <p
                  className={cn(
                    'flex items-start gap-1.5 text-[11px]',
                    bad ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {bad
                    ? <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    : <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  {c.duplicate ? 'Este video ya está en otro campo' : c.message}
                </p>
              )}

              <Input
                aria-label={`Título del video ${i + 1} (opcional)`}
                className="h-9"
                placeholder="Título (opcional)"
                value={row.title}
                onChange={(e) => setRow(i, { title: e.target.value })}
              />
            </li>
          )
        })}
      </ol>

      <Button size="sm" className="w-full" disabled={!canSubmit} onClick={submit}>
        <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Enviar a revisión
        {rows.length > 1 && ` (${rows.length})`}
      </Button>
    </section>
  )
}
