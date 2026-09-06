import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrandTab } from './brand-tab'
import type { Client } from '@/lib/supabase/types'

const updateClientProfile = vi.fn(async () => ({ ok: true }))
vi.mock('@/lib/actions/client-profile', () => ({
  updateClientProfile: (...args: unknown[]) => updateClientProfile(...(args as [])),
}))

const client = {
  id: 'c1',
  name: 'Barbería El Jefe',
  brand_colors: { primary: '#C9A227' },
  brand_fonts: { primary: 'Montserrat Bold', secondary: null },
  brand_voice: null,
  default_cta: null,
  default_hashtags: null,
  caption_notes: null,
} as unknown as Client

describe('BrandTab — tipografías', () => {
  it('renders the font inputs prefilled from brand_fonts', () => {
    render(<BrandTab client={client} />)
    expect(screen.getByLabelText('Tipografía primaria')).toHaveValue('Montserrat Bold')
    expect(screen.getByLabelText('Tipografía secundaria')).toHaveValue('')
  })

  it('saves colors and fonts together', async () => {
    render(<BrandTab client={client} />)
    fireEvent.change(screen.getByLabelText('Tipografía secundaria'), { target: { value: 'Lato' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar paleta y tipografías/ }))
    await waitFor(() => expect(updateClientProfile).toHaveBeenCalled())
    expect(updateClientProfile).toHaveBeenCalledWith('c1', {
      brand_colors: { primary: '#C9A227' },
      brand_fonts: { primary: 'Montserrat Bold', secondary: 'Lato' },
    })
  })
})
