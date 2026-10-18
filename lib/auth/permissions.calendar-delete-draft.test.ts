import { it, expect } from 'vitest'
import { hasPermission } from './permissions'
it('limits deleting calendar drafts to publishing administrators', () => {
 expect(hasPermission('owner', 'posting.calendar.delete_draft')).toBe(true)
 expect(hasPermission('supervisor', 'posting.calendar.delete_draft')).toBe(true)
 for (const role of ['editor', 'video', 'copy', 'disenador', 'team_member'] as const) expect(hasPermission(role, 'posting.calendar.delete_draft')).toBe(false)
})
