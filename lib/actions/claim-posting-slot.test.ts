import { describe,it,expect,vi } from 'vitest'
import { assignCadencePublishDate } from './claim-posting-slot'
it.each(['2026-09-08','2026-08-01'])('approval preserves the assigned date %s, including overdue dates that require review',async date=>{
 const update=vi.fn();const db={from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'i',client_id:'c',publish_date:date},error:null})})}),update})} as any
 expect(await assignCadencePublishDate(db,'i')).toBe(date)
 expect(update).not.toHaveBeenCalled()
})
