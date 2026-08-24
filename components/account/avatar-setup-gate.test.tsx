import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AvatarSetupGate } from './avatar-setup-gate'

const profile = vi.hoisted(() => ({ current: null as null | {
  full_name: string
  email: string
  avatar_url: string | null
} }))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ profile: profile.current }),
}))

vi.mock('@/lib/actions/avatar', () => ({ setAvatarUrl: vi.fn(), uploadAvatar: vi.fn() }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

describe('AvatarSetupGate', () => {
  beforeEach(() => {
    profile.current = null
    sessionStorage.clear()
  })

  it('asks for a photo when the profile only has a fallback', async () => {
    profile.current = { full_name: 'Jeand', email: 'j@nate.media', avatar_url: null }
    render(<AvatarSetupGate />)
    await waitFor(() => expect(screen.getByText('Pon tu foto')).toBeInTheDocument())
  })

  it('asks again if the saved url is generated initials', async () => {
    profile.current = {
      full_name: 'Jeand',
      email: 'j@nate.media',
      avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=Jeand',
    }
    render(<AvatarSetupGate />)
    await waitFor(() => expect(screen.getByText('Pon tu foto')).toBeInTheDocument())
  })

  it('does not ask when they already uploaded a real photo', () => {
    profile.current = {
      full_name: 'Jeand',
      email: 'j@nate.media',
      avatar_url: 'https://xxxx.supabase.co/storage/v1/object/public/avatars/u1/avatar.jpg',
    }
    render(<AvatarSetupGate />)
    expect(screen.queryByText('Pon tu foto')).not.toBeInTheDocument()
  })
})
