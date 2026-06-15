'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ProductionSchedule, ProductionContentType } from '@/lib/supabase/types'

// Live weekly production cadence, grouped per client from production_schedules.
// R = Reel, P = Post (the content_type bound to each client per day of week).
const DAYS = [
  { num: 1, short: 'Lun' },
  { num: 2, short: 'Mar' },
  { num: 3, short: 'Mié' },
  { num: 4, short: 'Jue' },
  { num: 5, short: 'Vie' },
  { num: 6, short: 'Sáb' },
  { num: 7, short: 'Dom' },
]

interface ClientRow {
  clientId: string
  name: string
  days: Map<number, ProductionContentType[]>
  total: number
}

function Pill({ type }: { type: ProductionContentType }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-none',
        type === 'R'
          ? 'bg-indigo-600 text-white'
          : 'bg-amber-500 text-zinc-900',
      )}
    >
      {type}
    </span>
  )
}

export function MasterScheduleView({ schedules }: { schedules: ProductionSchedule[] }) {
  const rows = useMemo<ClientRow[]>(() => {
    const byClient = new Map<string, ClientRow>()
    for (const s of schedules) {
      const name = s.client?.name ?? 'Sin nombre'
      let row = byClient.get(s.client_id)
      if (!row) {
        row = { clientId: s.client_id, name, days: new Map(), total: 0 }
        byClient.set(s.client_id, row)
      }
      const list = row.days.get(s.day_of_week) ?? []
      list.push(s.content_type)
      row.days.set(s.day_of_week, list)
      row.total += 1
    }
    return Array.from(byClient.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [schedules])

  const totalR = schedules.filter((s) => s.content_type === 'R').length
  const totalP = schedules.filter((s) => s.content_type === 'P').length

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Sin cadencia configurada. Usa <span className="font-medium text-foreground">Horarios</span> para asignar
        los días y tipos (R/P) de cada cliente.
      </div>
    )
  }

  const cols = 'grid grid-cols-[190px_repeat(7,1fr)_64px]'

  return (
    <div className="space-y-4">
      {/* Summary + legend */}
      <div data-testid="summary" className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span><span className="font-semibold text-foreground">{rows.length}</span> clientes</span>
        <span><span className="font-semibold text-foreground">{totalR}</span> reels / semana</span>
        <span><span className="font-semibold text-foreground">{totalP}</span> posts / semana</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5"><Pill type="R" /> Reel</span>
          <span className="flex items-center gap-1.5"><Pill type="P" /> Post</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        {/* Header */}
        <div className={cn(cols, 'min-w-[760px] border-b border-border bg-muted/50')}>
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</div>
          {DAYS.map((d) => (
            <div key={d.num} className="border-l border-border px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
              {d.short}
            </div>
          ))}
          <div className="border-l border-border px-2 py-2 text-center text-xs font-semibold text-muted-foreground">Total</div>
        </div>

        {/* Rows */}
        {rows.map((row, idx) => (
          <div
            key={row.clientId}
            data-row
            className={cn(cols, 'min-w-[760px] border-b border-border last:border-b-0', idx % 2 === 0 ? 'bg-background' : 'bg-muted/10')}
          >
            <div className="flex items-center px-3 py-2">
              <span className="truncate text-xs font-medium text-foreground">{row.name}</span>
            </div>
            {DAYS.map((d) => (
              <div
                key={d.num}
                data-testid={`cell-${d.num}`}
                className="flex min-h-[38px] items-center justify-center gap-1 border-l border-border px-1.5 py-1.5"
              >
                {(row.days.get(d.num) ?? []).map((t, i) => (
                  <Pill key={i} type={t} />
                ))}
              </div>
            ))}
            <div
              data-testid="total"
              className="flex items-center justify-center border-l border-border px-2 py-1.5 text-xs font-bold text-foreground"
            >
              {row.total}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cadencia semanal fija por cliente · <span className="font-medium">R</span> = Reel · <span className="font-medium">P</span> = Post
      </p>
    </div>
  )
}
