import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MobileNav } from './mobile-nav'

vi.mock('next/navigation', () => ({ usePathname: () => '/home' }))
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: 'owner' }),
}))

beforeEach(() => cleanup())

describe('MobileNav', () => {
  it('gives the nav sheet an accessible title for screen readers', () => {
    render(<MobileNav />)
    // Sheet content (and its title) only mounts once opened.
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Navegación')).toBeInTheDocument()
  })
})
