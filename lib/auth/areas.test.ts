import { describe, it, expect } from 'vitest'
import {
  AREAS,
  ALWAYS_ALLOWED_PREFIXES,
  areaForPath,
  effectiveAreaHrefs,
  canAccessPath,
  areaGrantsPermission,
} from './areas'
import type { UserRole } from '@/lib/supabase/types'

describe('AREAS catalogue', () => {
  it('is non-empty and never includes the mandatory landing (/home)', () => {
    expect(AREAS.length).toBeGreaterThan(5)
    expect(AREAS.find((a) => a.href === '/home')).toBeUndefined()
  })

  it('always allows the essential landing/changelog/pending prefixes', () => {
    expect(ALWAYS_ALLOWED_PREFIXES).toContain('/home')
  })
})

describe('areaForPath', () => {
  it('matches an exact area href', () => {
    expect(areaForPath('/clients')?.href).toBe('/clients')
  })

  it('matches a nested detail route to its parent area', () => {
    expect(areaForPath('/clients/123')?.href).toBe('/clients')
  })

  it('prefers the longest (most specific) area prefix', () => {
    // /clients/cadence is its own area and must win over /clients
    expect(areaForPath('/clients/cadence')?.href).toBe('/clients/cadence')
  })

  it('returns null for an unknown route', () => {
    expect(areaForPath('/totally-unknown')).toBeNull()
  })
})

describe('effectiveAreaHrefs', () => {
  it('owner gets every area regardless of area_access (anti-lockout)', () => {
    const hrefs = effectiveAreaHrefs('owner', ['/clients']) // restricted list ignored
    expect(hrefs.size).toBe(AREAS.length)
  })

  it('null area_access falls back to role permission defaults', () => {
    // editor lacks team.read → /team not present; has ideas.read → /ideas-aprobadas present
    const editor = effectiveAreaHrefs('editor', null)
    expect(editor.has('/team')).toBe(false)
    expect(editor.has('/ideas-aprobadas')).toBe(true)
  })

  it('explicit area_access overrides the role (independent of role)', () => {
    // editor explicitly granted /team — present even though the role lacks team.read
    const granted = effectiveAreaHrefs('editor', ['/team', '/clients'])
    expect(granted.has('/team')).toBe(true)
    expect(granted.has('/clients')).toBe(true)
    // ...and nothing else
    expect(granted.has('/posting')).toBe(false)
    expect(granted.size).toBe(2)
  })

  it('empty explicit list locks the user out of every restricted area', () => {
    expect(effectiveAreaHrefs('editor', []).size).toBe(0)
  })
})

describe('canAccessPath', () => {
  const role: UserRole = 'editor'

  it('always allows the landing page even with an empty grant', () => {
    expect(canAccessPath('/home', role, [])).toBe(true)
  })

  it('blocks a restricted area not in the explicit grant', () => {
    expect(canAccessPath('/posting', role, ['/team'])).toBe(false)
  })

  it('allows a granted area and its nested routes', () => {
    expect(canAccessPath('/team', role, ['/team'])).toBe(true)
    expect(canAccessPath('/team/approvals', role, ['/team'])).toBe(true)
  })

  it('owner can reach anything', () => {
    expect(canAccessPath('/settings/workflow', 'owner', [])).toBe(true)
  })

  it('null grant uses role defaults', () => {
    expect(canAccessPath('/ideas-aprobadas', 'editor', null)).toBe(true)
    expect(canAccessPath('/team', 'editor', null)).toBe(false)
  })

  it('allows unknown routes (api/detail not mapped to an area)', () => {
    expect(canAccessPath('/some/api/thing', role, [])).toBe(true)
  })
})

describe('areaGrantsPermission', () => {
  it('true when a user holds an area whose permission matches', () => {
    // editor granted /team area → effectively holds team.read
    expect(areaGrantsPermission('team.read', 'editor', ['/team'])).toBe(true)
  })

  it('false when the area is not granted', () => {
    expect(areaGrantsPermission('team.read', 'editor', ['/clients'])).toBe(false)
  })

  it('false for a null grant (defer to role-based check elsewhere)', () => {
    expect(areaGrantsPermission('team.read', 'editor', null)).toBe(false)
  })
})
