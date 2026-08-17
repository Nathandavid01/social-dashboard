import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Topbar } from './topbar'

vi.mock('@/components/layout/mobile-nav', () => ({
  MobileNav: () => <div data-testid="mobile-nav">Mobile Nav</div>,
}))

vi.mock('@/components/shared/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}))

vi.mock('@/components/auth/user-menu', () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}))

vi.mock('@/components/notifications/notification-bell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">Notification Bell</div>,
}))

vi.mock('@/components/presence/presence-bar', () => ({
  PresenceBar: () => <div data-testid="presence-bar">Presence Bar</div>,
}))

beforeEach(() => cleanup())

describe('Topbar', () => {
  const mockUser = {
    id: 'user-123',
    full_name: 'Test User',
    avatar_url: null,
  }

  it('renders theme toggle, notification bell, and user menu', () => {
    render(<Topbar currentUser={mockUser} />)
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
    expect(screen.getByTestId('user-menu')).toBeInTheDocument()
  })

  it('does not render the search button', () => {
    render(<Topbar currentUser={mockUser} />)
    expect(screen.queryByText('Buscar...')).not.toBeInTheDocument()
  })

  it('renders presence bar when user is provided', () => {
    render(<Topbar currentUser={mockUser} />)
    expect(screen.getByTestId('presence-bar')).toBeInTheDocument()
  })

  it('does not render presence bar when user is null', () => {
    render(<Topbar currentUser={null} />)
    expect(screen.queryByTestId('presence-bar')).not.toBeInTheDocument()
  })
})
