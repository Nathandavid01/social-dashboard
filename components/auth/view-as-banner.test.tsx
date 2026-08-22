import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ViewAsBanner } from './view-as-banner'

const auth = vi.hoisted(() => ({
  viewAsEditor: null as { id: string; full_name: string | null } | null,
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ viewAsEditor: auth.viewAsEditor }),
}))
vi.mock('@/lib/actions/view-as', () => ({ stopViewAs: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('ViewAsBanner', () => {
  it('no pinta nada si no hay vista', () => {
    auth.viewAsEditor = null
    const { container } = render(<ViewAsBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('dice de quién es la vista y permite salir', () => {
    auth.viewAsEditor = { id: 'e1', full_name: 'Lisneidy' }
    render(<ViewAsBanner />)
    expect(screen.getByText(/Lisneidy/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salir de esta vista/i })).toBeInTheDocument()
  })
})
