import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ClientStock } from '@/lib/inventario/video-stock-core'
import { LOW_STOCK_PANEL_STORAGE_KEY } from '@/lib/recording/low-stock-panel'
import { LowStockClientsPanel } from './low-stock-clients-panel'

function stock(over: Partial<ClientStock> & Pick<ClientStock, 'clientId' | 'clientName'>): ClientStock {
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
    daysLeft: 4,
    runOutDate: '2026-11-04',
    runOutFormat: 'reel',
    necesitaGrabar: true,
    health: 'critico',
    ...over,
  }
}

const clients = [
  stock({ clientId: '643', clientName: '643 Sport Bar & Pizzeria' }),
  stock({ clientId: 'mia', clientName: 'Mia Pizzeria', listos: 2, perWeek: 2, runOutDate: '2026-11-15', daysLeft: 12, health: 'bajo' }),
]

beforeEach(() => {
  localStorage.clear()
})

describe('LowStockClientsPanel', () => {
  it('renders the multi-client wall on Todos and closes it with the dismiss control', () => {
    render(<LowStockClientsPanel clients={clients} selectedClientId={null} scope="todos" onSelectClient={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Clientes por quedarse sin videos' })).toBeInTheDocument()
    expect(screen.getByText('2 por agotarse')).toBeInTheDocument()
    expect(screen.getByText('643 Sport Bar & Pizzeria')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar clientes por agotarse' }))
    expect(screen.queryByRole('region', { name: 'Clientes por quedarse sin videos' })).not.toBeInTheDocument()
    expect(localStorage.getItem(LOW_STOCK_PANEL_STORAGE_KEY)).toBe('1')
    expect(screen.getByRole('button', { name: '2 por agotarse' })).toBeInTheDocument()
  })

  it('stays closed on remount after an explicit dismiss', () => {
    localStorage.setItem(LOW_STOCK_PANEL_STORAGE_KEY, '1')
    render(<LowStockClientsPanel clients={clients} selectedClientId={null} scope="todos" onSelectClient={vi.fn()} />)
    expect(screen.queryByRole('region', { name: 'Clientes por quedarse sin videos' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 por agotarse' })).toBeInTheDocument()
  })

  it('hides the wall when a specific client is selected and does not treat that as a dismiss', () => {
    render(<LowStockClientsPanel clients={clients} selectedClientId="mia" scope="todos" onSelectClient={vi.fn()} />)
    expect(screen.queryByRole('region', { name: 'Clientes por quedarse sin videos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2 por agotarse' })).not.toBeInTheDocument()
    expect(localStorage.getItem(LOW_STOCK_PANEL_STORAGE_KEY)).toBeNull()
  })

  it('reopens from Por grabar after a dismiss so the videographer can see who is running out', () => {
    localStorage.setItem(LOW_STOCK_PANEL_STORAGE_KEY, '1')
    const onSelectClient = vi.fn()
    render(<LowStockClientsPanel clients={clients} selectedClientId={null} scope="todos" onSelectClient={onSelectClient} />)
    fireEvent.click(screen.getByRole('button', { name: 'Por grabar' }))
    expect(onSelectClient).toHaveBeenCalledWith('all')
    expect(screen.getByRole('region', { name: 'Clientes por quedarse sin videos' })).toBeInTheDocument()
    expect(localStorage.getItem(LOW_STOCK_PANEL_STORAGE_KEY)).toBe('0')
  })

  it('Ver calendario selects that client so the wall goes away', () => {
    const onSelectClient = vi.fn()
    render(<LowStockClientsPanel clients={clients} selectedClientId={null} scope="todos" onSelectClient={onSelectClient} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver calendario de 643 Sport Bar & Pizzeria' }))
    expect(onSelectClient).toHaveBeenCalledWith('643')
  })
})
