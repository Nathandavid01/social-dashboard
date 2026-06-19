'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const PERIODS = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
]

export function ReportSelector({
  type,
  clientId,
  days,
  clients,
}: {
  type: 'cliente' | 'agencia'
  clientId: string
  days: number
  clients: { id: string; name: string }[]
}) {
  const router = useRouter()

  function go(next: { type?: string; clientId?: string; days?: number }) {
    const t = next.type ?? type
    const params = new URLSearchParams()
    params.set('type', t)
    if (t === 'cliente') {
      const c = next.clientId ?? clientId
      if (c) params.set('clientId', c)
    }
    params.set('days', String(next.days ?? days))
    router.push(`/reportes?${params.toString()}`)
  }

  const selectCls =
    'h-9 rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Tipo
        <select className={selectCls} value={type} onChange={(e) => go({ type: e.target.value })}>
          <option value="cliente">Reporte de cliente</option>
          <option value="agencia">Resumen de agencia</option>
        </select>
      </label>

      {type === 'cliente' && (
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Cliente
          <select
            className={cn(selectCls, 'max-w-[220px]')}
            value={clientId}
            onChange={(e) => go({ clientId: e.target.value })}
          >
            <option value="">Elige un cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => go({ days: p.days })}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              days === p.days ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
