import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgencyBrandingForm } from './agency-branding-form'
import { DEFAULT_AGENCY_BRANDING } from '@/lib/utils/agency-branding'

vi.mock('@/lib/actions/agency-branding', () => ({
  updateAgencyBranding: vi.fn(async () => ({ ok: true, branding: DEFAULT_AGENCY_BRANDING })),
  uploadAgencyLogo: vi.fn(async () => ({ ok: true, branding: DEFAULT_AGENCY_BRANDING })),
  resetAgencyBranding: vi.fn(async () => ({ ok: true, branding: DEFAULT_AGENCY_BRANDING })),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe('AgencyBrandingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders logo presets and preview with default Nate branding', () => {
    render(<AgencyBrandingForm initial={DEFAULT_AGENCY_BRANDING} />)
    expect(screen.getByText('Logo del dashboard')).toBeInTheDocument()
    expect(screen.getByText('N monograma')).toBeInTheDocument()
    expect(screen.getByText('Radar / torre de control')).toBeInTheDocument()
    expect(screen.getByText('Logo propio')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre de la marca')).toHaveValue('Nate Media')
    expect(screen.getByRole('button', { name: /Guardar marca/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Subir logo propio/i })).toBeInTheDocument()
  })

  it('lets the owner pick the radar preset', () => {
    render(<AgencyBrandingForm initial={DEFAULT_AGENCY_BRANDING} />)
    fireEvent.click(screen.getByText('Radar / torre de control'))
    // After selection, the radar card is marked active (Check icon present in that card)
    expect(screen.getByText('Radar / torre de control').closest('button')).toHaveClass(
      'border-primary',
    )
  })

  it('updates brand name field for custom agency identity', () => {
    render(<AgencyBrandingForm initial={DEFAULT_AGENCY_BRANDING} />)
    const name = screen.getByLabelText('Nombre de la marca')
    fireEvent.change(name, { target: { value: 'Studio Caribe' } })
    expect(name).toHaveValue('Studio Caribe')
  })
})
