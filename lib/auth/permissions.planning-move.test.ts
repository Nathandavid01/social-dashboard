import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'

/**
 * `planning.move` gates dragging a content_idea card between stages on the
 * client Flujo board (see CLAUDE.md RBAC). Owner/supervisor/editor manage the
 * pipeline; the video role is recording-focused and must not move cards.
 *
 * Kept in its own file (instead of permissions.test.ts) to avoid colliding with
 * in-flight uncommitted edits to that file on eric/dev.
 */
describe('planning.move permission (moving cards on the Flujo board)', () => {
  it('owner, supervisor and editor may move cards', () => {
    expect(hasPermission('owner', 'planning.move')).toBe(true)
    expect(hasPermission('supervisor', 'planning.move')).toBe(true)
    expect(hasPermission('editor', 'planning.move')).toBe(true)
  })

  it('the video role and legacy team_member may NOT move cards', () => {
    expect(hasPermission('video', 'planning.move')).toBe(false)
    expect(hasPermission('team_member', 'planning.move')).toBe(false)
  })

  it('a null/undefined role may not move cards', () => {
    expect(hasPermission(null, 'planning.move')).toBe(false)
    expect(hasPermission(undefined, 'planning.move')).toBe(false)
  })
})
