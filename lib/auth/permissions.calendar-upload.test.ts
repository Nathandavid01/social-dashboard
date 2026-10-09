import { it, expect } from 'vitest'
import { hasPermission } from './permissions'
it('limits direct calendar uploads to publishing administrators', () => {
 expect(hasPermission('owner', 'posting.calendar.upload')).toBe(true)
 expect(hasPermission('supervisor', 'posting.calendar.upload')).toBe(true)
 for (const role of ['editor', 'video', 'copy', 'disenador', 'team_member'] as const) expect(hasPermission(role, 'posting.calendar.upload')).toBe(false)
})
