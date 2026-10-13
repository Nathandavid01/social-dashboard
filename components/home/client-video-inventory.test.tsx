import { fireEvent, render, screen } from '@testing-library/react'
import { it, expect } from 'vitest'
import { ClientVideoInventory } from './client-video-inventory'

it('shows the editor and separate unpublished counts, with client/editor search and unknown schedules', () => {
  render(<ClientVideoInventory rows={[
    { clientId: 'a', clientName: 'Café El Bosque', status: 'active', editors: ['Nathan'], edited: 4, raw: 7, scheduled: 2, unverified: 0 },
    { clientId: 'b', clientName: 'Otro', status: 'paused', editors: [], edited: 0, raw: 0, scheduled: null, unverified: 1 },
  ]} checkedAt="2026-10-13T12:00:00Z" />)
  expect(screen.getByText('Videos sin publicar por cliente')).toBeInTheDocument()
  expect(screen.getByText('Nathan')).toBeInTheDocument()
  expect(screen.getByText('Sin verificar')).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar cliente o editor' }), { target: { value: 'nathan' } })
  expect(screen.getByText('Café El Bosque')).toBeInTheDocument()
  expect(screen.queryByText('Otro')).not.toBeInTheDocument()
})
