/**
 * Tests for the inline day picker (components/planning/inline-day-picker.tsx).
 *
 * Contract (docs/superpowers/specs/2026-05-29-cadence-edit-mode-design.md):
 *   Read mode is the default and is non-interactive — clicking a day must NOT
 *   persist anything. A "Editar" button enters edit mode, where days toggle a
 *   local draft (still no save), and "Guardar"/"Cancelar" commit or discard.
 *   0-day drafts are allowed (= "Sin cadencia").
 *
 * dayLabelsShort indexes by JS weekday (0=Dom..6=Sáb). The picker renders
 * Lun..Dom = [1,2,3,4,5,6,0].
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── Mock the server action the component imports ─────────────────────────────
const setClientPostingDays = vi.fn(async (_clientId: string, _days: number[]) => ({}) as { error?: string })
vi.mock('@/lib/actions/posting-days', () => ({
  setClientPostingDays: (...a: unknown[]) => setClientPostingDays(...(a as [string, number[]])),
}))

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { InlineDayPicker } from './inline-day-picker'

function dayButton(label: string) {
  // The day chips/buttons carry aria-pressed; find by accessible label text.
  return screen
    .getAllByText(label, { selector: 'button, span' })
    .find((el) => el.getAttribute('aria-pressed') !== null) as HTMLElement | undefined
}

beforeEach(() => {
  cleanup()
  setClientPostingDays.mockClear()
  setClientPostingDays.mockResolvedValue({})
})

describe('read mode (default)', () => {
  it('renders an "Editar" button and no Guardar/Cancelar', () => {
    render(<InlineDayPicker clientId="c1" initial={[2, 4, 6]} />)
    expect(screen.getByRole('button', { name: /editar días de cadencia/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar días/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument()
  })

  it('shows the initial days as selected (aria-pressed)', () => {
    render(<InlineDayPicker clientId="c1" initial={[2, 4, 6]} />)
    expect(dayButton('Mar')?.getAttribute('aria-pressed')).toBe('true')
    expect(dayButton('Lun')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking a day in read mode does NOT call the server action', async () => {
    const user = userEvent.setup()
    render(<InlineDayPicker clientId="c1" initial={[2, 4, 6]} />)
    const lun = dayButton('Lun')
    // In read mode days are spans, not buttons — but even if clickable, no save.
    if (lun) await user.click(lun)
    expect(setClientPostingDays).not.toHaveBeenCalled()
  })
})

describe('edit mode', () => {
  it('clicking "Editar" reveals Guardar and Cancelar', async () => {
    const user = userEvent.setup()
    render(<InlineDayPicker clientId="c1" initial={[2, 4, 6]} />)
    await user.click(screen.getByRole('button', { name: /editar días de cadencia/i }))
    expect(screen.getByRole('button', { name: /guardar días/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })

  it('toggling a day updates selection but does NOT call the action yet', async () => {
    const user = userEvent.setup()
    render(<InlineDayPicker clientId="c1" initial={[2, 4, 6]} />)
    await user.click(screen.getByRole('button', { name: /editar días de cadencia/i }))
    await user.click(dayButton('Lun')!)
    expect(dayButton('Lun')?.getAttribute('aria-pressed')).toBe('true')
    expect(setClientPostingDays).not.toHaveBeenCalled()
  })

  it('Guardar calls setClientPostingDays with the edited draft and returns to read mode', async () => {
    const user = userEvent.setup()
    render(<InlineDayPicker clientId="c1" initial={[2, 4, 6]} />)
    await user.click(screen.getByRole('button', { name: /editar días de cadencia/i }))
    await user.click(dayButton('Lun')!) // add Monday (1)
    await user.click(screen.getByRole('button', { name: /guardar días/i }))
    expect(setClientPostingDays).toHaveBeenCalledWith('c1', [1, 2, 4, 6])
    // back to read mode
    expect(await screen.findByRole('button', { name: /editar días de cadencia/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar días/i })).not.toBeInTheDocument()
  })

  it('Cancelar reverts the draft and does NOT call the action', async () => {
    const user = userEvent.setup()
    render(<InlineDayPicker clientId="c1" initial={[2, 4, 6]} />)
    await user.click(screen.getByRole('button', { name: /editar días de cadencia/i }))
    await user.click(dayButton('Lun')!) // would add Monday
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(setClientPostingDays).not.toHaveBeenCalled()
    // Monday reverted to unselected in read mode
    expect(dayButton('Lun')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('clearing all days then Guardar persists [] (Sin cadencia allowed)', async () => {
    const user = userEvent.setup()
    render(<InlineDayPicker clientId="c1" initial={[2]} />)
    await user.click(screen.getByRole('button', { name: /editar días de cadencia/i }))
    await user.click(dayButton('Mar')!) // remove the only day → empty
    await user.click(screen.getByRole('button', { name: /guardar días/i }))
    expect(setClientPostingDays).toHaveBeenCalledWith('c1', [])
  })
})
