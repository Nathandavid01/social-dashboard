import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientTabs, resolveClientTab } from './client-tabs'

const slots = {
  overview: <p>resumen</p>,
  schedule: <p>calendario</p>,
  content: <p>contenido</p>,
  brand: <p>marca</p>,
  account: <p>cuenta</p>,
}

describe('ClientTabs simplificado', () => {
  it('muestra solo las pestañas esenciales', () => {
    render(<ClientTabs {...slots} access={<p>accesos</p>} />)
    const labels = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(labels).toEqual(['Resumen', 'Calendario', 'Contenido', 'Marca', 'Accesos', 'Cuenta'])
  })

  it('oculta «Accesos» si el usuario no puede verlos', () => {
    render(<ClientTabs {...slots} />)
    expect(screen.queryByRole('tab', { name: /Accesos/ })).not.toBeInTheDocument()
  })

  it('los enlaces viejos ?tab= siguen abriendo la sección correcta', () => {
    expect(resolveClientTab('billing')).toBe('account')
    expect(resolveClientTab('contract')).toBe('account')
    expect(resolveClientTab('assets')).toBe('brand')
    expect(resolveClientTab('tasks')).toBe('content')
    expect(resolveClientTab('captions')).toBe('content')
    expect(resolveClientTab('schedule')).toBe('schedule')
    expect(resolveClientTab('access')).toBe('access')
    expect(resolveClientTab('nada')).toBe('overview')
    expect(resolveClientTab(undefined)).toBe('overview')
  })
})
