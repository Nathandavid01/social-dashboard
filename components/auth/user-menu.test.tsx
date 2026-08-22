import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from './user-menu'

const auth = vi.hoisted(() => ({
  role: 'editor' as string,
  realRole: 'editor' as string,
  editors: [] as { id: string; full_name: string | null }[],
}))

vi.mock('@/lib/actions/auth', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/actions/view-as', () => ({
  startViewAsEditor: vi.fn(),
  stopViewAs: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/lib/actions/avatar', () => ({
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}))
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({
    profile: { full_name: 'Ana Díaz', email: 'ana@nate.media', avatar_url: null },
    role: auth.role,
    realRole: auth.realRole,
    viewAsEditor: null,
    editors: auth.editors,
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

beforeEach(() => {
  cleanup()
  auth.role = 'editor'
  auth.realRole = 'editor'
  auth.editors = []
})

describe('UserMenu', () => {
  it('offers theme toggle inside the menu, not as a header icon', async () => {
    const user = userEvent.setup()
    render(<UserMenu />)

    expect(screen.queryByRole('button', { name: /toggle theme/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button'))
    expect(await screen.findByText('Tema claro')).toBeInTheDocument()
  })

  it('un owner elige a qué editor ver', async () => {
    auth.role = 'owner'
    auth.realRole = 'owner'
    auth.editors = [{ id: 'e1', full_name: 'Lisneidy' }]
    const user = userEvent.setup()
    render(<UserMenu />)
    await user.click(screen.getByRole('button'))
    expect(await screen.findByText('Ver como editor')).toBeInTheDocument()
  })
})
