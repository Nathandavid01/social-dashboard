import { describe, it, expect } from 'vitest'
import {
  isApproved,
  isPending,
  filterPendingApprovals,
  resolveApprovalRedirect,
  validateApprovalRole,
} from './approval-core'
import type { Profile } from '@/lib/supabase/types'

function makeProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    email: 'someone@nmedia.pr',
    full_name: 'Someone',
    avatar_url: null,
    role: 'team_member',
    status: 'active',
    approval_status: 'pending',
    title: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('isApproved / isPending', () => {
  it('treats only approved as approved', () => {
    expect(isApproved(makeProfile({ approval_status: 'approved' }))).toBe(true)
    expect(isApproved(makeProfile({ approval_status: 'pending' }))).toBe(false)
    expect(isApproved(makeProfile({ approval_status: 'rejected' }))).toBe(false)
  })

  it('detects pending', () => {
    expect(isPending(makeProfile({ approval_status: 'pending' }))).toBe(true)
    expect(isPending(makeProfile({ approval_status: 'approved' }))).toBe(false)
  })

  it('handles a null profile gracefully', () => {
    expect(isApproved(null)).toBe(false)
    expect(isPending(null)).toBe(false)
  })
})

describe('filterPendingApprovals', () => {
  it('keeps only pending profiles, newest first', () => {
    const profiles = [
      makeProfile({ id: 'a', approval_status: 'approved' }),
      makeProfile({ id: 'b', approval_status: 'pending', created_at: '2026-02-01T00:00:00Z' }),
      makeProfile({ id: 'c', approval_status: 'pending', created_at: '2026-03-01T00:00:00Z' }),
      makeProfile({ id: 'd', approval_status: 'rejected' }),
    ]
    const result = filterPendingApprovals(profiles)
    expect(result.map((p) => p.id)).toEqual(['c', 'b'])
  })

  it('returns an empty array when none are pending', () => {
    expect(filterPendingApprovals([makeProfile({ approval_status: 'approved' })])).toEqual([])
  })
})

describe('resolveApprovalRedirect', () => {
  it('lets approved users through (null = no redirect)', () => {
    expect(resolveApprovalRedirect(makeProfile({ approval_status: 'approved' }))).toBeNull()
  })

  it('sends pending users to the waiting page', () => {
    expect(resolveApprovalRedirect(makeProfile({ approval_status: 'pending' }))).toBe('/pending')
  })

  it('signs rejected users out to login with a flag', () => {
    expect(resolveApprovalRedirect(makeProfile({ approval_status: 'rejected' }))).toBe('/login?rejected=1')
  })

  it('does not redirect when there is no profile (unauthenticated)', () => {
    expect(resolveApprovalRedirect(null)).toBeNull()
  })
})

describe('validateApprovalRole', () => {
  it('accepts every assignable role', () => {
    for (const role of ['owner', 'supervisor', 'editor', 'video'] as const) {
      expect(validateApprovalRole(role)).toEqual({ ok: true })
    }
  })

  it('rejects the legacy team_member role and garbage', () => {
    expect(validateApprovalRole('team_member' as never).ok).toBe(false)
    expect(validateApprovalRole('nope' as never).ok).toBe(false)
    expect(validateApprovalRole(undefined as never).ok).toBe(false)
  })
})
