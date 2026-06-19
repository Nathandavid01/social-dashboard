import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PageHeader } from './page-header'

afterEach(cleanup)

describe('PageHeader', () => {
  it('renders the title as a heading', () => {
    render(<PageHeader title="Clientes" />)
    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument()
  })

  it('renders the optional description', () => {
    render(<PageHeader title="Clientes" description="Gestiona tu cartera" />)
    expect(screen.getByText('Gestiona tu cartera')).toBeInTheDocument()
  })

  it('renders the optional action', () => {
    render(<PageHeader title="Clientes" action={<button>Agregar</button>} />)
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument()
  })

  it('stacks on mobile and rows on desktop (responsive container)', () => {
    const { container } = render(<PageHeader title="Clientes" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('flex-col')
    expect(root.className).toContain('sm:flex-row')
  })
})
