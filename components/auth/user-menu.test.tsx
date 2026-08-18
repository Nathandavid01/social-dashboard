import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from './user-menu'

vi.mock('@/lib/actions/auth', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/actions/avatar', () => ({
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}))
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    profile: { full_name: 'Ana Díaz', email: 'ana@nate.media', avatar_url: null },
    role: 'editor',
  }),
}))
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => false,
}))
vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', resolvedTheme: 'dark', setTheme: vi.fn() }),
}))

beforeEach(() => cleanup())

describe('UserMenu', () => {
  it('offers theme toggle inside the menu, not as a header icon', async () => {
    const user = userEvent.setup()
    render(<UserMenu />)

    expect(screen.queryByRole('button', { name: /toggle theme/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button'))
    expect(await screen.findByText('Tema claro')).toBeInTheDocument()
  })
})
