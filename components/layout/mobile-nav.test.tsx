import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MobileNav } from './mobile-nav'

vi.mock('next/navigation', () => ({ usePathname: () => '/home' }))
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: 'owner' }),
}))

beforeEach(() => cleanup())

describe('MobileNav', () => {
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
