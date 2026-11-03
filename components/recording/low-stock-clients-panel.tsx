'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { clientDisplayName } from '@/lib/utils/client-display-name'
import type { ClientStock } from '@/lib/inventario/video-stock-core'
import {
  horizonLabel,
  pendingVideosLabel,
  readLowStockPanelDismissed,
  shouldShowLowStockPanel,
  untilLabel,
  writeLowStockPanelDismissed,
  type LowStockScope,
} from '@/lib/recording/low-stock-panel'
import { Button } from '@/components/ui/button'

export function LowStockClientsPanel({
  clients,
  selectedClientId,
  scope = 'todos',
  onSelectClient,
}: {
  clients: ClientStock[]
  selectedClientId: string | null
  scope?: LowStockScope
  onSelectClient: (clientId: string) => void
}) {
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setDismissed(readLowStockPanelDismissed())
    setHydrated(true)
  }, [])

  const specificClient = Boolean(selectedClientId && selectedClientId !== 'all')
  const open = shouldShowLowStockPanel({
    selectedClientId,
    dismissed,
    lowStockCount: clients.length,
    scope,
  })

  if (clients.length === 0 || specificClient) return null

  function dismiss() {
    setDismissed(true)
    writeLowStockPanelDismissed(true)
  }

  function reopen() {
    setDismissed(false)
    writeLowStockPanelDismissed(false)
    onSelectClient('all')
  }

  if (!hydrated) return null

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => reopen()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 text-xs font-medium"
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          {clients.length} por agotarse
        </button>
        <button
          type="button"
          onClick={() => reopen()}
          className="inline-flex min-h-11 items-center rounded-full border border-transparent px-3 text-xs font-medium text-muted-foreground hover:bg-muted/60"
        >
          Por grabar
        </button>
      </div>
    )
  }

  return (
    <section
      aria-label="Clientes por quedarse sin videos"
      className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Preparar próximas grabaciones
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight sm:text-xl">
            Clientes por quedarse sin videos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Menos de dos semanas de videos editados pendientes, según su frecuencia semanal.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium whitespace-nowrap">
            {clients.length} por agotarse
          </span>
          <button
            type="button"
            onClick={() => reopen()}
            className="inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-medium"
          >
            Por grabar
          </button>
          <button
            type="button"
            aria-label="Cerrar clientes por agotarse"
            onClick={dismiss}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Cerrar</span>
          </button>
          <button
            type="button"
            aria-label="Ocultar clientes por agotarse"
            onClick={dismiss}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            Ocultar
          </button>
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => {
          const until = untilLabel(client.runOutDate)
          const name = clientDisplayName(client.clientName)
          return (
            <li key={client.clientId} className="rounded-xl border bg-background p-4">
              <p className="text-[11px] font-medium text-muted-foreground">{horizonLabel(client.health)}</p>
              <p className="mt-1 truncate text-sm font-semibold">{name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{pendingVideosLabel(client.listos, client.perWeek)}</p>
              {until && <p className="mt-1 text-xs text-muted-foreground">{until}</p>}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3 min-h-11 rounded-full"
                onClick={() => onSelectClient(client.clientId)}
                aria-label={`Ver calendario de ${name}`}
              >
                Ver calendario
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
