import { it, expect, vi } from 'vitest'
const run=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/actions/idea-posting-run',()=>({runIdeaPost:run}))
vi.mock('@/lib/auth/server',()=>({requirePermission:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}}})}})}))
import {maybeAutoPostIdea} from './idea-posting'
it('approval never schedules without an explicit staff click',async()=>{
 run.mockResolvedValue({error:'Metricool API error: 401'})
 expect(await maybeAutoPostIdea('i')).toBeNull()
 expect(run).not.toHaveBeenCalled()
})
