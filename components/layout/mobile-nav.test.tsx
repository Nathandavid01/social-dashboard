import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MobileNav } from './mobile-nav'

vi.mock('next/navigation', () => ({ usePathname: () => '/home' }))
const auth = vi.hoisted(() => ({ id: 'u1', viewAsEditor: null as { id: string } | null }))
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: auth.id, email: 'u@x.com' }, profile: null, role: 'owner', viewAsEditor: auth.viewAsEditor }),
}))

beforeEach(() => { cleanup(); auth.id = 'u1'; auth.viewAsEditor = null })

describe('MobileNav', () => {
  it('hides inventory from other owners, including view-as Nathan', () => {
    auth.viewAsEditor = { id: '165e5259-8f69-4ff4-b0f0-f790cba77b80' }
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /menú/i }))
    expect(screen.queryByRole('link', { name: 'Inventario de videos' })).not.toBeInTheDocument()
  })

  it('shows inventory to the real Nathan account', () => {
    auth.id = '165e5259-8f69-4ff4-b0f0-f790cba77b80'
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /menú/i }))
    expect(screen.getByRole('link', { name: 'Inventario de videos' })).toBeInTheDocument()
  })
  it('exposes an always-visible Menú trigger on mobile', () => {
    render(<MobileNav />)
    const trigger = screen.getByRole('button', { name: /menú/i })
    expect(trigger).toBeInTheDocument()
    expect(trigger.className).toMatch(/shrink-0/)
  })

  it('gives the nav sheet an accessible title for screen readers', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /menú/i }))
    expect(screen.getByText('Navegación')).toBeInTheDocument()
  })
})
