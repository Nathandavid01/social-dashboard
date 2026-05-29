'use client'

import { useState, useTransition } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dayLabelsShort } from '@/lib/utils/posting-cadence'
import { setClientPostingDays } from '@/lib/actions/posting-days'
import { useToast } from '@/lib/hooks/use-toast'

const ORDER = [1, 2, 3, 4, 5, 6, 0] // Lun..Dom

const CHIP_BASE = 'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors'

/** One weekday badge — a static span in read mode, a toggle button in edit mode. */
function DayChip({
  label,
  active,
  editing,
  disabled,
  onToggle,
}: {
  label: string
  active: boolean
  editing: boolean
  disabled: boolean
  onToggle: () => void
}) {
  if (!editing) {
    return (
      <span
        aria-pressed={active}
        className={cn(CHIP_BASE, active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
      >
        {label}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onToggle() }}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        CHIP_BASE,
        'disabled:opacity-60',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

function sameDays(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const sb = [...b].sort((x, y) => x - y)
  return [...a].sort((x, y) => x - y).every((v, i) => v === sb[i])
}

export function InlineDayPicker({ clientId, initial }: { clientId: string; initial: number[] }) {
  const [days, setDays] = useState<number[]>(initial)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number[]>(initial)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function startEdit() {
    setDraft(days)
    setEditing(true)
  }

  function cancel() {
    if (isPending) return
    setDraft(days)
    setEditing(false)
  }

  function toggle(d: number) {
    setDraft((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b),
    )
  }

  function save() {
    startTransition(async () => {
      const res = await setClientPostingDays(clientId, draft)
      if (res.error) {
        toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
        return
      }
      setDays(draft)
      setEditing(false)
    })
  }

  const shown = editing ? draft : days
  const dirty = !sameDays(draft, days)

  return (
    <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex items-center gap-0.5">
        {ORDER.map((d) => (
          <DayChip
            key={d}
            label={dayLabelsShort[d]}
            active={shown.includes(d)}
            editing={editing}
            disabled={isPending}
            onToggle={() => toggle(d)}
          />
        ))}
      </span>

      {!editing ? (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); startEdit() }}
          aria-label="Editar días de cadencia"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
          Editar
        </button>
      ) : (
        <span className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); save() }}
            disabled={isPending || !dirty}
            aria-label="Guardar días de cadencia"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            Guardar
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); cancel() }}
            disabled={isPending}
            aria-label="Cancelar edición de cadencia"
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
          >
            <X className="h-3 w-3" />
            Cancelar
          </button>
        </span>
      )}
    </span>
  )
}
