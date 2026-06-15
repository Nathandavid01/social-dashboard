/**
 * ImportMetricoolButton: loads importable Metricool brands and creates the
 * selected ones as clients.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

const getImportable = vi.fn(async () => ({ brands: [{ id: '101', name: 'Dr. Loyola' }, { id: '102', name: 'Neumáticos PR' }] }))
const importBrands = vi.fn(async () => ({ imported: 2 }))
vi.mock('@/lib/actions/metricool-import', () => ({
  getImportableMetricoolBrands: (...a: unknown[]) => getImportable(...(a as [])),
  importMetricoolBrands: (...a: unknown[]) => importBrands(...(a as [])),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { ImportMetricoolButton } from './import-metricool-button'

beforeEach(() => {
  cleanup()
  getImportable.mockClear()
  importBrands.mockClear()
})

describe('ImportMetricoolButton', () => {
  it('loads importable brands when opened and imports the selected ones', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<ImportMetricoolButton />)

    await user.click(screen.getByRole('button', { name: /importar de metricool/i }))
    // brands loaded + listed (selected by default)
    expect(await screen.findByText('Dr. Loyola')).toBeInTheDocument()
    expect(screen.getByText('Neumáticos PR')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /importar \(2\)/i }))
    expect(importBrands).toHaveBeenCalledWith([
      { id: '101', name: 'Dr. Loyola' },
      { id: '102', name: 'Neumáticos PR' },
    ])
  })

  it('shows an all-imported message when there is nothing to import', async () => {
    getImportable.mockResolvedValueOnce({ brands: [] })
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<ImportMetricoolButton />)
    await user.click(screen.getByRole('button', { name: /importar de metricool/i }))
    expect(await screen.findByText(/ya están como clientes/i)).toBeInTheDocument()
  })
})
