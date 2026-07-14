import { describe, it, expect } from 'vitest'
import { navItems, visibleNavItems } from './nav-items'

/**
 * The sidebar hides items the current role can't access. visibleNavItems is the
 * pure filter behind that — an item shows when it has no `permission` gate OR
 * the role satisfies it. Owner ('*') sees everything; a null role (logged out)
 * sees only the ungated items.
 */
describe('navItems source', () => {
  it('excludes deep-link (nav:false) areas like /inbox and /alerts', () => {
    const hrefs = navItems.map((n) => n.href)
    expect(hrefs).not.toContain('/inbox')
    expect(hrefs).not.toContain('/alerts')
    expect(hrefs).not.toContain('/operations')
    expect(hrefs).not.toContain('/planning')
  })

  it('includes /home and the regular nav areas', () => {
    const hrefs = navItems.map((n) => n.href)
    expect(hrefs).toContain('/home')
    expect(hrefs).toContain('/clients')
    expect(hrefs).toContain('/settings/users')
  })
})

describe('visibleNavItems', () => {
  it('owner sees every nav item', () => {
    expect(visibleNavItems('owner')).toHaveLength(navItems.length)
  })

  it('a null role sees only ungated (permission-less) items', () => {
    const visible = visibleNavItems(null)
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.every((n) => !n.permission)).toBe(true)
    const hrefs = visible.map((n) => n.href)
    expect(hrefs).toContain('/home') // Inicio has no permission gate
    expect(hrefs).toContain('/mi-dia') // your own work — nothing to authorize
    // /calendar USED to be ungated (any role could see every client's schedule).
    // It's now behind clients.read, like the client list it draws from.
    expect(hrefs).not.toContain('/calendar')
  })

  it('every nav area lives in a section — a flat 20-item wall is not a menu', () => {
    const ungrouped = navItems
      .filter((n) => n.href !== '/home' && n.href !== '/mi-dia')
      .filter((n) => !n.group)
    expect(ungrouped).toEqual([])
  })

  it('hides a permission-gated item when the role lacks the permission', () => {
    // /settings/workflow requires settings.edit: owner has it, a null role does not.
    expect(visibleNavItems('owner').some((n) => n.href === '/settings/workflow')).toBe(true)
    expect(visibleNavItems(null).some((n) => n.href === '/settings/workflow')).toBe(false)
  })
})

/**
 * The `areaAccess` branch — the one the real sidebar always takes, since the
 * layout always passes a value (null or a list).
 *
 * This block exists because of a real regression: the filter used to hardcode
 * `n.href === '/home'`, so any OTHER always-allowed destination silently
 * vanished from the sidebar for EVERY role, owner included. `/mi-dia` — the
 * landing, and the flagship screen — shipped invisible: reachable only by typing
 * the URL, and gone the moment you clicked anything else. Nothing in the suite
 * caught it, because nothing exercised this branch.
 */
describe('visibleNavItems with an areaAccess grant (the branch the sidebar uses)', () => {
  const hrefs = (role: Parameters<typeof visibleNavItems>[0], access: string[] | null) =>
    visibleNavItems(role, access).map((n) => n.href)

  it.each(['owner', 'supervisor', 'editor', 'video', 'team_member'] as const)(
    'shows the always-allowed destinations to %s (no per-user restriction)',
    (role) => {
      expect(hrefs(role, null)).toContain('/mi-dia')
      expect(hrefs(role, null)).toContain('/home')
    },
  )

  it('still shows them to a user locked down to one unrelated area', () => {
    // Their own day is their own work — there is nothing to authorize.
    expect(hrefs('editor', ['/clients'])).toContain('/mi-dia')
    expect(hrefs('editor', ['/clients'])).toContain('/home')
  })

  it('keeps hiding the areas a restricted user cannot reach', () => {
    const visible = hrefs('editor', ['/clients'])
    expect(visible).toContain('/clients')
    expect(visible).not.toContain('/settings/users')
    expect(visible).not.toContain('/pipeline')
  })
})
