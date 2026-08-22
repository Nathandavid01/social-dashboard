import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OnsiteShot } from '@/lib/onsite/shot-types'

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/actions/onsite', () => ({
  toggleShotRecorded: vi.fn(),
  removeShotFromSession: vi.fn(),
  updateShotDetails: vi.fn(),
  addIdeaToSession: vi.fn(),
}))

import { OnsiteChecklist } from './onsite-checklist'

const shot = (over: Partial<OnsiteShot> = {}): OnsiteShot => ({
  id: 'x',
  title: 'Idea real',
  hook: null,
  visualBrief: null,
  viralityScore: null,
  viralityWhy: null,
  referenceUrl: null,
  shotType: 'sony',
  recorded: false,
  ...over,
})

describe('OnsiteChecklist — huecos = 50% más que el mes', () => {
  it('pinta espacios vacíos hasta el objetivo del cliente', () => {
    render(
      <OnsiteChecklist
        sessionId="s1"
        initialShots={[shot({ id: '1', title: 'Hook A' }), shot({ id: '2', title: 'Hook B', recorded: true })]}
        addable={[]}
        slotTarget={6}
      />,
    )
    expect(screen.getAllByTestId('onsite-empty-slot')).toHaveLength(4)
    expect(screen.getByText('4 por idear')).toBeInTheDocument()
    expect(screen.getByText('Faltan 5')).toBeInTheDocument()
  })

  it('un hueco vacío abre el panel para añadir ideas', async () => {
    const user = userEvent.setup()
    render(
      <OnsiteChecklist sessionId="s1" initialShots={[]} addable={[]} slotTarget={6} />,
    )
    expect(screen.queryByText('Añadir como:')).not.toBeInTheDocument()
    await user.click(screen.getAllByTestId('onsite-empty-slot')[0])
    expect(screen.getByText('Añadir como:')).toBeInTheDocument()
  })

  it('sin cuota no inventa huecos y muestra el vacío de siempre', () => {
    render(<OnsiteChecklist sessionId="s1" initialShots={[]} addable={[]} slotTarget={0} />)
    expect(screen.queryByText('Por idear')).not.toBeInTheDocument()
    expect(screen.getByText('Esta sesión no tiene tomas todavía')).toBeInTheDocument()
    expect(screen.getByText(/no tiene frecuencia en el perfil/)).toBeInTheDocument()
  })
})
