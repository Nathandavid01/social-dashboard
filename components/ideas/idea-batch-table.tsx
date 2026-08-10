'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Trash2, ExternalLink } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { SHOT_TYPES, shotTypeLabel } from '@/lib/onsite/shot-types'
import {
  emptyIdeaRow, withTrailingBlank, countWritten, toPayload, type IdeaRow,
} from '@/lib/ideas/batch-entry'
import { createIdeasBatch, discardWrittenIdea, type WrittenIdea } from '@/lib/actions/ideas-batch'

const CONTENT_TYPES = [
  { key: 'R', label: 'Reel' },
  { key: 'P', label: 'Post' },
  { key: 'C', label: 'Carrusel' },
  { key: 'S', label: 'Story' },
] as const

/**
 * Escribir el lote de ideas de un cliente, como se hacía en el documento.
 *
 * Una fila por idea y una vacía siempre al final: pulsar "añadir fila" por cada
 * idea era la fricción que hacía preferir el PDF. Enter en el último campo
 * salta a la siguiente fila.
 */
export function IdeaBatchTable({
  clientId,
  clientName,
  existing,
}: {
  clientId: string
  clientName: string
  existing: WrittenIdea[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [rows, setRows] = useState<IdeaRow[]>([emptyIdeaRow()])
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState<string | null>(null)

  const escritas = useMemo(() => countWritten(rows), [rows])

  function set(i: number, patch: Partial<IdeaRow>) {
    setRows((rs) => {
      const next = rs.map((r, j) => (j === i ? { ...r, ...patch } : r))
      return withTrailingBlank(next)
    })
  }

  async function guardar() {
    const payload = toPayload(rows)
    if (payload.length === 0) return
    setGuardando(true)
    const res = await createIdeasBatch({ clientId, rows: payload })
    setGuardando(false)
    if (res.error) {
      toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
      return
    }
    toast({ title: `${res.created} idea${res.created === 1 ? '' : 's'} guardada${res.created === 1 ? '' : 's'}` })
    setRows([emptyIdeaRow()])
    router.refresh()
  }

  async function descartar(id: string) {
    setBorrando(id)
    const res = await discardWrittenIdea(id)
    setBorrando(null)
    if (res.error) {
      toast({ title: 'No se pudo descartar', description: res.error, variant: 'destructive' })
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="min-w-0 truncate text-[13px] font-semibold">Escribir ideas · {clientName}</h2>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {escritas} escrita{escritas === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-1.5 pr-2 font-medium">Título</th>
                <th className="pb-1.5 pr-2 font-medium">¿De qué es?</th>
                <th className="pb-1.5 pr-2 font-medium">Formato</th>
                <th className="pb-1.5 pr-2 font-medium">Toma</th>
                <th className="pb-1.5 font-medium">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input
                      value={r.title}
                      onChange={(e) => set(i, { title: e.target.value })}
                      placeholder={i === rows.length - 1 ? 'Nueva idea…' : ''}
                      aria-label={`Título de la idea ${i + 1}`}
                      className="h-8 w-full min-w-[160px] rounded-md border bg-background px-2 text-[12px] outline-none focus:border-primary/50"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      value={r.hook}
                      onChange={(e) => set(i, { hook: e.target.value })}
                      aria-label={`De qué es la idea ${i + 1}`}
                      className="h-8 w-full min-w-[200px] rounded-md border bg-background px-2 text-[12px] outline-none focus:border-primary/50"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      value={r.contentType}
                      onChange={(e) => set(i, { contentType: e.target.value })}
                      aria-label={`Formato de la idea ${i + 1}`}
                      className="h-8 rounded-md border bg-background px-1.5 text-[11px] outline-none"
                    >
                      {CONTENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      value={r.shotType}
                      onChange={(e) => set(i, { shotType: e.target.value })}
                      aria-label={`Tipo de toma de la idea ${i + 1}`}
                      className="h-8 rounded-md border bg-background px-1.5 text-[11px] outline-none"
                    >
                      <option value="">Sin tipo</option>
                      {SHOT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1">
                    <input
                      value={r.referenceUrl}
                      onChange={(e) => set(i, { referenceUrl: e.target.value })}
                      placeholder="https://…"
                      aria-label={`Referencia de la idea ${i + 1}`}
                      className="h-8 w-full min-w-[180px] rounded-md border bg-background px-2 text-[12px] outline-none focus:border-primary/50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Las ideas entran sin grabar. On Site las recoge para marcarlas en el sitio.
          </p>
          <button
            onClick={guardar}
            disabled={guardando || escritas === 0}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition disabled:opacity-50"
          >
            {guardando
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
            Guardar {escritas > 0 && `(${escritas})`}
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border bg-card p-3">
        <h2 className="text-[13px] font-semibold">
          Sin grabar <span className="text-muted-foreground tabular-nums">({existing.length})</span>
        </h2>
        {existing.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            Este cliente no tiene ideas pendientes.
          </p>
        ) : (
          <ul className="divide-y">
            {existing.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px]">{i.title}</span>
                  {i.hook && <span className="block truncate text-[11px] text-muted-foreground">{i.hook}</span>}
                </span>
                {i.shotType && (
                  <span className="shrink-0 whitespace-nowrap rounded-full border px-1.5 text-[9px] text-muted-foreground">
                    {shotTypeLabel(i.shotType)}
                  </span>
                )}
                {i.referenceUrl && (
                  <a
                    href={i.referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Referencia de ${i.title}`}
                    className="shrink-0 rounded-md border p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
                <button
                  onClick={() => descartar(i.id)}
                  disabled={borrando === i.id}
                  aria-label={`Descartar ${i.title}`}
                  className="shrink-0 rounded-md border p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                >
                  {borrando === i.id
                    ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    : <Trash2 className="h-3 w-3" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
