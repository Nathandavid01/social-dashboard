'use client'

import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assignClient, updateClientBatchConfig, type BatchConfig, type TeamMember } from '@/lib/actions/client-batch'

interface Props {
  clientId: string
  videosCount: number
  config: BatchConfig
  members: TeamMember[]
  assignee: { id: string; full_name: string | null } | null | undefined
  onChanged: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">{label}</span>
      {children}
    </div>
  )
}

/** Editable LOTE / cantidad / ENCARGADO summary for the batch view. */
export function BatchSummaryBar({ clientId, videosCount, config, members, assignee, onChanged }: Props) {
  const [, start] = useTransition()

  const [editingLabel, setEditingLabel] = useState(false)
  const [label, setLabel] = useState(config.batchLabel ?? '')
  const [editingQty, setEditingQty] = useState(false)
  const [qty, setQty] = useState(config.videosPerBatch?.toString() ?? '')

  function saveLabel() {
    setEditingLabel(false)
    start(async () => {
      await updateClientBatchConfig(clientId, { batchLabel: label })
      onChanged()
    })
  }
  function saveQty() {
    setEditingQty(false)
    const n = qty.trim() === '' ? null : Math.max(1, Math.min(60, parseInt(qty, 10) || 1))
    start(async () => {
      await updateClientBatchConfig(clientId, { videosPerBatch: n })
      onChanged()
    })
  }
  function assign(v: string) {
    start(async () => {
      await assignClient(clientId, v === 'unassigned' ? null : v)
      onChanged()
    })
  }

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3">
      {/* LOTE */}
      <Field label="Lote">
        {editingLabel ? (
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
            placeholder="Nombre del lote"
            className="h-7 w-32 text-sm"
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="group flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            {config.batchLabel || 'Lote actual'}
            <Pencil className="h-3 w-3 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />
          </button>
        )}
      </Field>

      <div className="h-7 w-px bg-border" />

      {/* VIDEOS (cantidad, override) */}
      <Field label="Videos">
        {editingQty ? (
          <Input
            autoFocus
            type="number"
            min={1}
            max={60}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={saveQty}
            onKeyDown={(e) => e.key === 'Enter' && saveQty()}
            placeholder={String(videosCount)}
            className="h-7 w-20 text-sm"
          />
        ) : (
          <button
            onClick={() => setEditingQty(true)}
            className="group flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            {config.videosPerBatch ?? videosCount} {(config.videosPerBatch ?? videosCount) === 1 ? 'video' : 'videos'}
            <Pencil className="h-3 w-3 text-muted-foreground/40 opacity-0 transition group-hover:opacity-100" />
          </button>
        )}
      </Field>

      <div className="h-7 w-px bg-border" />

      {/* ENCARGADO (asignación) */}
      <Field label="Encargado">
        <Select value={assignee?.id ?? 'unassigned'} onValueChange={assign}>
          <SelectTrigger className="h-7 w-40 border-0 bg-transparent px-0 text-sm font-semibold shadow-none focus:ring-0">
            <SelectValue placeholder="Sin asignar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Sin asignar</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {(m.full_name ?? '?').slice(0, 1).toUpperCase()}
                  </span>
                  {m.full_name ?? 'Sin nombre'}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}
