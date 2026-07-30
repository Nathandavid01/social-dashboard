import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './status-badge'
import { CLIENT_ESTADOS } from '@/lib/clients/estado'

describe('StatusBadge', () => {
  it('muestra la etiqueta en español de los cinco estados', () => {
    for (const e of CLIENT_ESTADOS) {
      const { unmount } = render(<StatusBadge status={e.key} />)
      expect(screen.getByText(e.label)).toBeInTheDocument()
      unmount()
    }
  })

  it('los dos estados nuevos no salen en blanco ni como "undefined"', () => {
    render(<StatusBadge status="proximo_a_grabar" />)
    expect(screen.getByText('Próximo a grabar')).toBeInTheDocument()
    render(<StatusBadge status="sin_contenido" />)
    expect(screen.getByText('Sin contenido')).toBeInTheDocument()
  })

  it('un estado que la interfaz no conoce se muestra tal cual', () => {
    render(<StatusBadge status="archivado" />)
    expect(screen.getByText('archivado')).toBeInTheDocument()
  })
})
