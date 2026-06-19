import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import { EmptyState } from './empty-state'

afterEach(cleanup)

describe('EmptyState', () => {
  it('renders title, description, hint and action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Sin clientes"
        description="Aún no has agregado clientes"
        hint="Prueba a limpiar los filtros"
        action={<button>Agregar cliente</button>}
      />,
    )
    expect(screen.getByText('Sin clientes')).toBeInTheDocument()
    expect(screen.getByText('Aún no has agregado clientes')).toBeInTheDocument()
    expect(screen.getByText('Prueba a limpiar los filtros')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar cliente' })).toBeInTheDocument()
  })

  it('wraps in a dashed card by default', () => {
    const { container } = render(<EmptyState icon={Inbox} title="Vacío" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('border-dashed')
  })

  it('omits the card wrapper when bordered=false', () => {
    const { container } = render(<EmptyState icon={Inbox} title="Vacío" bordered={false} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).not.toContain('border-dashed')
  })
})
