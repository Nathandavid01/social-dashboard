import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UserAdminTable } from './user-admin-table'
import type { Profile } from '@/lib/supabase/types'

vi.mock('@/lib/actions/users', () => ({ updateUserProfile: vi.fn(), setUserStatus: vi.fn() }))
vi.mock('@/components/team/role-selector', () => ({ RoleSelector: () => <div data-testid="role-selector" /> }))
vi.mock('@/components/team/create-user-dialog', () => ({ CreateUserDialog: () => <div data-testid="create-user" /> }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const users = [
  { id: 'u1', email: 'a@x.com', full_name: 'Ana', role: 'editor', status: 'active', title: 'COO', avatar_url: null, created_at: '', updated_at: '' },
  { id: 'u2', email: 'b@x.com', full_name: 'Bob', role: 'video', status: 'inactive', title: null, avatar_url: null, created_at: '', updated_at: '' },
] as Profile[]

describe('UserAdminTable', () => {
  it('renders a row per user with editable name and email', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    expect(screen.getByText('a@x.com')).toBeInTheDocument()
    expect(screen.getByText('b@x.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ana')).toBeInTheDocument()
    expect(screen.getByDisplayValue('COO')).toBeInTheDocument()
  })

  it('marks an inactive user', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('disables the status toggle for the current user', () => {
    render(<UserAdminTable users={users} currentUserId="u1" />)
    // Ana's row (u1) is the current user → her status button is disabled.
    expect(screen.getByRole('button', { name: 'Activo' })).toBeDisabled()
  })

  it('shows a count of users', () => {
    render(<UserAdminTable users={users} currentUserId="me" />)
    expect(screen.getByText('2 usuarios')).toBeInTheDocument()
  })
})
