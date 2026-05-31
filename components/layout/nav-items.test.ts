import { describe, it, expect } from 'vitest'
import { navItems, visibleNavItems } from './nav-items'

/**
 * The sidebar hides items the current role can't access. visibleNavItems is the
 * pure filter behind that — an item shows when it has no `permission` gate OR
 * the role satisfies it. Owner ('*') sees everything; a null role (logged out)
 * sees only the ungated items.
 */
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
    expect(hrefs).toContain('/calendar') // Calendario has no permission gate
  })

  it('hides a permission-gated item when the role lacks the permission', () => {
    // /settings/workflow requires settings.edit: owner has it, a null role does not.
    expect(visibleNavItems('owner').some((n) => n.href === '/settings/workflow')).toBe(true)
    expect(visibleNavItems(null).some((n) => n.href === '/settings/workflow')).toBe(false)
  })
})
