import type { ClientStock, StockHealth } from '@/lib/inventario/video-stock-core'

export const LOW_STOCK_PANEL_STORAGE_KEY = 'nm-low-stock-panel-dismissed'

export type LowStockScope = 'todos' | 'por_grabar'

const LOW_STOCK: StockHealth[] = ['agotado', 'critico', 'bajo']

const MES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Clients with less than two weeks of edited videos, soonest run-out first. */
export function selectLowStockClients(clients: ClientStock[]): ClientStock[] {
  return clients
    .filter((c) => LOW_STOCK.includes(c.health))
    .slice()
    .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
}

/**
 * The multi-client wall only belongs on Todos / Por grabar.
 * A specific client is a fast path: hide the wall, do not persist that hide.
 */
export function shouldShowLowStockPanel(args: {
  selectedClientId: string | null
  dismissed: boolean
  lowStockCount: number
  scope: LowStockScope
}): boolean {
  if (args.lowStockCount <= 0) return false
  if (args.selectedClientId && args.selectedClientId !== 'all') return false
  if (args.dismissed) return false
  return args.scope === 'todos' || args.scope === 'por_grabar'
}

export function horizonLabel(health: StockHealth): string {
  if (health === 'bajo') return '1–2 semanas'
  return 'Una semana o menos'
}

export function pendingVideosLabel(listos: number, perWeek: number): string {
  const videos = listos === 1 ? '1 video editado pendiente' : `${listos} videos editados pendientes`
  return `${videos} — ${perWeek} por semana`
}

export function untilLabel(runOutDate: string | null): string | null {
  if (!runOutDate) return null
  const [y, m, d] = runOutDate.split('-').map(Number)
  if (!y || !m || !d) return null
  return `Hasta ≈ ${d} ${MES_ES[m - 1]} ${y}`
}

export function readLowStockPanelDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LOW_STOCK_PANEL_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeLowStockPanelDismissed(dismissed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOW_STOCK_PANEL_STORAGE_KEY, dismissed ? '1' : '0')
  } catch {
    // Private mode / quota — the toggle still works for this visit.
  }
}
