'use client'

import { useMemo, useState } from 'react'
import { Link2, AlertCircle, Send, Film, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DIAS, type DiaKey } from '@/lib/entregas/dias'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

/**
 * Submit box at the top of the Editado column. The editor says how many videos
 * of a client are going to review and uploads THE FILE for each one.
 *
 * Why the file and not just a Drive link: Metricool publishes from a permanent,
 * public, range-streamable URL, which in this app means R2 — see
 * lib/actions/idea-posting-run.ts (it selects `storage_provider = 'r2'`) and the
 * note in lib/integrations/r2.ts about expiring presigned URLs. A Drive link is
 * an auth-walled viewer page, so it can never be the published media; passed to
 * Metricool it only becomes a first comment (lib/metricool/post.ts). The link
 * stays here as an optional reference for the reviewer.
 */

/** Matches the ceiling used by the existing R2 uploader (idea-video-panel). */
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024

/** Sanity cap: a batch bigger than this is a sign something went wrong. */
export const MAX_VIDEOS_PER_SUBMIT = 10

export interface SubmitVideoItem {
  /** The real file — the caller presigns, PUTs to R2 and registers it. */
  file: File
  /** Optional reference for the reviewer. Never the published media. */
  driveLink: string | null
  title: string
}

export interface SubmitVideoPayload {
  clientId: string
  /** Día de la semana para el que se entrega el lote. */
  dia: DiaKey
  videos: SubmitVideoItem[]
}

interface Row {
  file: File | null
  link: string
  title: string
}

const emptyRow = (): Row => ({ file: null, link: '', title: '' })

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

type RowCheck = { ok: boolean; message: string | null }

function checkFile(file: File | null, duplicate: boolean): RowCheck {
  if (!file) return { ok: false, message: null }
  if (duplicate) return { ok: false, message: 'Este archivo ya está en otro campo' }
  if (!file.type.startsWith('video/')) return { ok: false, message: 'El archivo tiene que ser un video' }
  if (file.size > MAX_VIDEO_BYTES) {
    return { ok: false, message: `El archivo es demasiado grande (máx. ${formatBytes(MAX_VIDEO_BYTES)})` }
  }
  return { ok: true, message: null }
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
  const [dia, setDia] = useState<DiaKey | null>(null)
  const [rows, setRows] = useState<Row[]>([emptyRow()])

  const clientName = clients.find((c) => c.id === clientId)?.name ?? 'Cliente'

  const checks = useMemo(() => {
    const seen = new Map<string, number>()
    return rows.map((r, i) => {
      let duplicate = false
      if (r.file) {
        // name+size is the closest thing to identity a File gives us.
        const key = `${r.file.name}:${r.file.size}`
        const first = seen.get(key)
        if (first !== undefined && first < i) duplicate = true
        else seen.set(key, i)
      }
      return checkFile(r.file, duplicate)
    })
  }, [rows])

  const readyCount = checks.filter((c) => c.ok).length
  const canSubmit = !!clientId && dia !== null && readyCount === rows.length && !pending

  function setCount(raw: string) {
    const n = Number.parseInt(raw, 10)
    if (Number.isNaN(n)) return
    const next = Math.min(Math.max(n, 1), MAX_VIDEOS_PER_SUBMIT)
    setRows((prev) =>
      next <= prev.length
        ? prev.slice(0, next)
        : [...prev, ...Array.from({ length: next - prev.length }, emptyRow)],
    )
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function submit() {
    if (!canSubmit || dia === null) return
    onSubmit({
      clientId,
      dia,
      videos: rows.map((r, i) => ({
        file: r.file!,
        driveLink: r.link.trim() || null,
        title: r.title.trim() || `${clientName} — video ${i + 1}`,
      })),
    })
    setClientId('')
    setDia(null)
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
              <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay clientes asignados</p>
            ) : (
              clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px]">¿Para qué día? *</Label>
        <div className="flex flex-wrap gap-1">
          {DIAS.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-label={d.label}
              aria-pressed={dia === d.key}
              onClick={() => setDia(d.key)}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] font-medium transition',
                dia === d.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {d.short}
            </button>
          ))}
        </div>
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
          return (
            <li key={i} className="space-y-1.5 rounded-lg border bg-muted/30 p-2">
              <p className="text-[11px] font-medium text-muted-foreground">Video {i + 1}</p>

              <div className="space-y-1">
                <Label htmlFor={`sv-file-${i}`} className="sr-only">Archivo del video {i + 1}</Label>
                <Input
                  id={`sv-file-${i}`}
                  type="file"
                  accept="video/*"
                  aria-label={`Archivo del video ${i + 1}`}
                  className="h-9 cursor-pointer py-1.5 text-[11px] file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-[11px]"
                  onChange={(e) => setRow(i, { file: e.target.files?.[0] ?? null })}
                />
                {row.file && (
                  <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
                    {c.ok
                      ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      : <Film className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    <span className="truncate">{row.file.name}</span>
                    <span className="shrink-0 tabular-nums">· {formatBytes(row.file.size)}</span>
                  </p>
                )}
                {c.message && (
                  <p className="flex items-start gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {c.message}
                  </p>
                )}
              </div>

              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  aria-label={`Enlace de Drive del video ${i + 1} (opcional)`}
                  className="h-9 pl-9"
                  placeholder="Enlace de Drive (opcional)"
                  value={row.link}
                  onChange={(e) => setRow(i, { link: e.target.value })}
                />
              </div>

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
