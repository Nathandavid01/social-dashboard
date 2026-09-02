import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserAdminTable } from './user-admin-table'
import type { Profile } from '@/lib/supabase/types'

vi.mock('@/lib/actions/users', () => ({ updateUserProfile: vi.fn(), setUserStatus: vi.fn(), setUserAvatar: vi.fn(async () => ({ ok: true })), removeUserAvatar: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/components/team/role-selector', () => ({ RoleSelector: () => <div data-testid="role-selector" /> }))
vi.mock('@/components/team/area-access-inline', () => ({ AreaAccessPanel: () => <div data-testid="area-access" /> }))
vi.mock('@/components/team/reset-password-dialog', () => ({ ResetPasswordDialog: () => <div data-testid="reset-password" /> }))
vi.mock('@/components/team/create-user-dialog', () => ({ CreateUserDialog: () => <div data-testid="create-user" /> }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const users = [
  { id: 'u1', email: 'ana@x.com', full_name: 'Ana Lopez', role: 'owner', status: 'active', title: 'CEO', avatar_url: null, area_access: null },
  { id: 'u2', email: 'bob@x.com', full_name: 'Bob Marz', role: 'editor', status: 'inactive', title: null, avatar_url: null, area_access: null },
  { id: 'u3', email: 'cleo@x.com', full_name: 'Cleo Diaz', role: 'supervisor', status: 'active', title: null, avatar_url: null, area_access: ['/x'] },
] as unknown as Profile[]

describe('UserAdminTable', () => {
  it('renders a card per user with name and email', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.getByText('ana@x.com', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Bob Marz')).toBeInTheDocument()
    expect(screen.getByText('cleo@x.com', { exact: false })).toBeInTheDocument()
  })

  it('shows the people count', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    expect(screen.getByText('3 personas')).toBeInTheDocument()
  })

  it('filters by search query (name or email)', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'bob' } })
    expect(screen.getByText('Bob Marz')).toBeInTheDocument()
    expect(screen.queryByText('Ana Lopez')).not.toBeInTheDocument()
  })

  it('filters by role segment', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    fireEvent.click(screen.getByRole('button', { name: 'Owners' }))
    expect(screen.getByText('Ana Lopez')).toBeInTheDocument()
    expect(screen.queryByText('Bob Marz')).not.toBeInTheDocument()
    expect(screen.queryByText('Cleo Diaz')).not.toBeInTheDocument()
  })

  it('marks inactive users and shows status', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0)
  })

  it('shows an empty state when nothing matches', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: 'zzzz' } })
    expect(screen.getByText(/no encontramos/i)).toBeInTheDocument()
  })
})

describe('UserAdminTable — fotos de perfil', () => {
  const withPhoto = [
    { id: 'u1', email: 'ana@x.com', full_name: 'Ana Lopez', role: 'owner', status: 'active', title: null, avatar_url: 'https://cdn/ana.png', area_access: null },
    { id: 'u2', email: 'bob@x.com', full_name: 'Bob Marz', role: 'editor', status: 'active', title: null, avatar_url: null, area_access: null },
  ] as unknown as Profile[]

  it('muestra la foto real cuando existe y las iniciales cuando no', () => {
    render(<UserAdminTable users={withPhoto} currentUserId="me" canEditPhotos={false} />)
    const img = screen.getByRole('img', { name: 'Foto de Ana Lopez' })
    expect(img).toHaveAttribute('src', 'https://cdn/ana.png')
    expect(screen.getByText('BM')).toBeInTheDocument()
  })

  it('un owner puede cambiar o quitar la foto de cada persona desde el avatar', () => {
    render(<UserAdminTable users={withPhoto} currentUserId="me" canEditPhotos />)
    expect(screen.getByRole('button', { name: 'Cambiar foto de Ana Lopez' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar foto de Bob Marz' })).toBeInTheDocument()
  })

  it('sin permiso, el avatar no es un botón', () => {
    render(<UserAdminTable users={withPhoto} currentUserId="me" canEditPhotos={false} />)
    expect(screen.queryByRole('button', { name: /Cambiar foto/ })).not.toBeInTheDocument()
  })

  it('el resumen de accesos se lee de un vistazo: completo por rol o N áreas', () => {
    const restricted = [
      ...withPhoto,
      { id: 'u3', email: 'cleo@x.com', full_name: 'Cleo Diaz', role: 'supervisor', status: 'active', title: null, avatar_url: null, area_access: ['/pipeline'] },
    ] as unknown as Profile[]
    render(<UserAdminTable users={restricted} currentUserId="me" canEditPhotos={false} />)
    expect(screen.getAllByText('Acceso completo').length).toBeGreaterThan(0)
    expect(screen.getByText('1 área')).toBeInTheDocument()
  })
})
