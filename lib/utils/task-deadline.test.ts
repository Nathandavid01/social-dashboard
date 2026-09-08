import {expect,it} from 'vitest'
import {taskIsOverdue,taskIsDueToday} from './task-deadline'
const now='2026-09-09T01:00:00Z' // Sept 8 at 9 PM Puerto Rico
it('keeps late-evening Puerto Rico work in today when UTC is tomorrow',()=>{
 expect(taskIsDueToday({due_at:'2026-09-09T03:00:00Z'},now)).toBe(true)
 expect(taskIsDueToday({due_at:'2026-09-08T02:00:00Z'},now)).toBe(false)
 expect(taskIsDueToday({due_at:'2026-09-09T04:00:00Z'},now)).toBe(false)
})
it('compares absolute times even when ISO offsets sort differently',()=>{
 expect(taskIsOverdue({due_at:'2026-09-08T23:30:00-04:00'},now)).toBe(false)
 expect(taskIsOverdue({due_at:'2026-09-09T02:00:00+02:00'},now)).toBe(true)
})
it('does not call completed or future work overdue',()=>{
 expect(taskIsOverdue({due_at:'2026-09-08T12:00:00Z',status:'completed'},now)).toBe(false)
 expect(taskIsOverdue({due_at:now},now)).toBe(false)
})
it.each([null,undefined,'invalid'])('does not invent a deadline for %s',due_at=>{
 expect(taskIsOverdue({due_at},now)).toBe(false)
 expect(taskIsDueToday({due_at},now)).toBe(false)
})
