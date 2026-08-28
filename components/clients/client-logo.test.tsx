import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientLogo } from './client-logo'

describe('ClientLogo', () => {
  it('muestra el <img> del logo cuando hay URL', () => {
    render(<ClientLogo name="Speedy Net" logoUrl="https://cdn.example/speedy.png" />)
    const img = screen.getByRole('img', { name: 'Speedy Net' })
    expect(img).toHaveAttribute('src', 'https://cdn.example/speedy.png')
    expect(screen.queryByText('SP')).not.toBeInTheDocument()
  })

  it('cae a iniciales si no hay logo (o la URL está vacía)', () => {
    const { rerender } = render(<ClientLogo name="Speedy Net" logoUrl={null} />)
    expect(screen.getByLabelText('Speedy Net')).toHaveTextContent('SP')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    rerender(<ClientLogo name="Speedy Net" logoUrl="   " />)
    expect(screen.getByLabelText('Speedy Net')).toHaveTextContent('SP')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
