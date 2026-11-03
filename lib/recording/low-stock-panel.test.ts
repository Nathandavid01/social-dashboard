import { describe, expect, it } from 'vitest'
import type { ClientStock } from '@/lib/inventario/video-stock-core'
import {
  LOW_STOCK_PANEL_STORAGE_KEY,
  horizonLabel,
  pendingVideosLabel,
  readLowStockPanelDismissed,
  selectLowStockClients,
  shouldShowLowStockPanel,
  untilLabel,
  writeLowStockPanelDismissed,
} from './low-stock-panel'

function stock(over: Partial<ClientStock> & Pick<ClientStock, 'clientId' | 'clientName' | 'health'>): ClientStock {
  return {
    logoUrl: null,
    perWeek: 3,
    listos: 1,
    reels: 1,
    posts: 0,
    agendados: 0,
    crudo: 0,
    sinArchivo: 0,
    porGrabar: 0,
    salieron: 0,
    lastRawAt: null,
    daysLeft: 5,
    runOutDate: '2026-11-04',
    runOutFormat: 'reel',
    necesitaGrabar: true,
    ...over,
  }
}

describe('selectLowStockClients', () => {
  it('keeps clients with less than two weeks of edited videos and drops the rest', () => {
    const rows = selectLowStockClients([
      stock({ clientId: 'a', clientName: 'Apiario', health: 'critico', daysLeft: 4 }),
      stock({ clientId: 'b', clientName: 'Black Pepper', health: 'ok', daysLeft: 21, necesitaGrabar: false }),
      stock({ clientId: 'c', clientName: 'El Caldo', health: 'bajo', daysLeft: 10 }),
      stock({ clientId: 'd', clientName: 'Lenel', health: 'sin_cadencia', daysLeft: null, necesitaGrabar: false }),
      stock({ clientId: 'e', clientName: 'Mia', health: 'agotado', daysLeft: 0, listos: 0 }),
    ])
    expect(rows.map((c) => c.clientId)).toEqual(['e', 'a', 'c'])
  })
})

describe('shouldShowLowStockPanel', () => {
  it('shows the wall only for Todos / Por grabar when there are low-stock clients and it is not dismissed', () => {
    expect(shouldShowLowStockPanel({ selectedClientId: null, dismissed: false, lowStockCount: 9, scope: 'todos' })).toBe(true)
    expect(shouldShowLowStockPanel({ selectedClientId: null, dismissed: false, lowStockCount: 9, scope: 'por_grabar' })).toBe(true)
  })

  it('hides the wall when a specific client is selected so Grabación jumps to that client', () => {
    expect(shouldShowLowStockPanel({
      selectedClientId: 'mia',
      dismissed: false,
      lowStockCount: 9,
      scope: 'todos',
    })).toBe(false)
  })

  it('hides the wall after an explicit dismiss, even on Todos', () => {
    expect(shouldShowLowStockPanel({ selectedClientId: null, dismissed: true, lowStockCount: 9, scope: 'todos' })).toBe(false)
  })

  it('stays hidden when nobody is running out', () => {
    expect(shouldShowLowStockPanel({ selectedClientId: null, dismissed: false, lowStockCount: 0, scope: 'todos' })).toBe(false)
  })
})

describe('low-stock copy', () => {
  it('names the horizon and pending cuts in Spanish', () => {
    expect(horizonLabel('agotado')).toBe('Una semana o menos')
    expect(horizonLabel('critico')).toBe('Una semana o menos')
    expect(horizonLabel('bajo')).toBe('1–2 semanas')
    expect(pendingVideosLabel(1, 3)).toBe('1 video editado pendiente — 3 por semana')
    expect(pendingVideosLabel(2, 2)).toBe('2 videos editados pendientes — 2 por semana')
    expect(untilLabel('2026-11-04')).toBe('Hasta ≈ 4 nov 2026')
    expect(untilLabel(null)).toBeNull()
  })
})

describe('dismiss persistence', () => {
  it('round-trips the closed preference through localStorage', () => {
    localStorage.clear()
    expect(readLowStockPanelDismissed()).toBe(false)
    writeLowStockPanelDismissed(true)
    expect(localStorage.getItem(LOW_STOCK_PANEL_STORAGE_KEY)).toBe('1')
    expect(readLowStockPanelDismissed()).toBe(true)
    writeLowStockPanelDismissed(false)
    expect(readLowStockPanelDismissed()).toBe(false)
  })
})
