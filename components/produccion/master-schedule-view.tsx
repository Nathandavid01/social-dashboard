'use client'

import { useMemo, useState, useTransition } from 'react'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import { upsertProductionSchedules } from '@/lib/actions/production'
import { cycleCadence, dayMapToSchedules, type DayCadence } from '@/lib/utils/cadence-core'
import type { ProductionSchedule, ProductionContentType } from '@/lib/supabase/types'

// Live weekly production cadence, grouped per client from production_schedules.
// R = Reel, P = Post. With canEdit, cells cycle empty→R→P→empty and auto-save.
const DAYS = [
  { num: 1, short: 'Lun' },
  { num: 2, short: 'Mar' },
  { num: 3, short: 'Mié' },
  { num: 4, short: 'Jue' },
  { num: 5, short: 'Vie' },
  { num: 6, short: 'Sáb' },
  { num: 7, short: 'Dom' },
]

function Pill({ type }: { type: ProductionContentType }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold leading-none',
        type === 'R' ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-zinc-900',
      )}
    >
      {type}
    </span>
  )
}

interface ClientMeta {
  clientId: string
  name: string
}

export function MasterScheduleView({
  schedules,
  canEdit = false,
}: {
  schedules: ProductionSchedule[]
  canEdit?: boolean
}) {
  const { toast } = useToast()
  const [, startTransition] = useTransition()

  const clients = useMemo<ClientMeta[]>(() => {
    const seen = new Map<string, string>()
    for (const s of schedules) {
      if (!seen.has(s.client_id)) seen.set(s.client_id, s.client?.name ?? 'Sin nombre')
    }
    return Array.from(seen.entries())
      .map(([clientId, name]) => ({ clientId, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [schedules])

  // clientId -> { day -> type }, the working (optimistic) state.
  const [maps, setMaps] = useState<Record<string, Record<number, DayCadence>>>(() => {
    const m: Record<string, Record<number, DayCadence>> = {}
    for (const s of schedules) {
      ;(m[s.client_id] ??= {})[s.day_of_week] = s.content_type
    }
    return m
  })

  const totalR = Object.values(maps).reduce((n, m) => n + Object.values(m).filter((t) => t === 'R').length, 0)
  const totalP = Object.values(maps).reduce((n, m) => n + Object.values(m).filter((t) => t === 'P').length, 0)

  function clickCell(clientId: string, day: number) {
    if (!canEdit) return
    setMaps((prev) => {
      const cm = { ...(prev[clientId] ?? {}) }
      cm[day] = cycleCadence(cm[day] ?? null)
      const next = { ...prev, [clientId]: cm }
      startTransition(async () => {
        // Full replace per client (existingDays non-empty forces delete+insert).
        const res = await upsertProductionSchedules(clientId, dayMapToSchedules(cm), [1, 2, 3, 4, 5, 6, 7])
        if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      })
      return next
    })
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Sin cadencia configurada. Asígnala desde el perfil de cada cliente (pestaña <span className="font-medium text-foreground">Calendario</span>)
        o con el botón <span className="font-medium text-foreground">Horarios</span>.
      </div>
    )
  }

  const cols = 'grid grid-cols-[190px_repeat(7,1fr)_64px]'

  return (
    <div className="space-y-4">
      <div data-testid="summary" className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span><span className="font-semibold text-foreground">{clients.length}</span> clientes</span>
        <span><span className="font-semibold text-foreground">{totalR}</span> reels / semana</span>
        <span><span className="font-semibold text-foreground">{totalP}</span> posts / semana</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5"><Pill type="R" /> Reel</span>
          <span className="flex items-center gap-1.5"><Pill type="P" /> Post</span>
        </div>
      </div>

      {canEdit && (
        <p className="text-xs text-muted-foreground">Toca una celda para alternar <span className="font-medium">R → P → vacío</span>. Se guarda automáticamente.</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <div className={cn(cols, 'min-w-[760px] border-b border-border bg-muted/50')}>
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</div>
          {DAYS.map((d) => (
            <div key={d.num} className="border-l border-border px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d.short}</div>
          ))}
          <div className="border-l border-border px-2 py-2 text-center text-xs font-semibold text-muted-foreground">Total</div>
        </div>

        {clients.map((c, idx) => {
          const dm = maps[c.clientId] ?? {}
          const total = DAYS.reduce((n, d) => n + (dm[d.num] ? 1 : 0), 0)
          return (
            <div
              key={c.clientId}
              data-row
              className={cn(cols, 'min-w-[760px] border-b border-border last:border-b-0', idx % 2 === 0 ? 'bg-background' : 'bg-muted/10')}
            >
              <div className="flex items-center px-3 py-2">
                <span className="truncate text-xs font-medium text-foreground">{c.name}</span>
              </div>
              {DAYS.map((d) => {
                const t = dm[d.num] ?? null
                const inner = t ? <Pill type={t} /> : canEdit ? <span className="text-muted-foreground/30">·</span> : null
                return (
                  <div key={d.num} data-testid={`cell-${d.num}`} className="border-l border-border">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => clickCell(c.clientId, d.num)}
                        aria-label={`${c.name} ${d.short}`}
                        className="flex min-h-[38px] w-full items-center justify-center px-1.5 py-1.5 transition-colors hover:bg-muted/60"
                      >
                        {inner}
                      </button>
                    ) : (
                      <div className="flex min-h-[38px] items-center justify-center px-1.5 py-1.5">{inner}</div>
                    )}
                  </div>
                )
              })}
              <div data-testid="total" className="flex items-center justify-center border-l border-border px-2 py-1.5 text-xs font-bold text-foreground">
                {total}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cadencia semanal por cliente · <span className="font-medium">R</span> = Reel · <span className="font-medium">P</span> = Post
      </p>
    </div>
  )
}
