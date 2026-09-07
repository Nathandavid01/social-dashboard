import { it, expect, vi } from 'vitest'
const run=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/actions/idea-posting-run',()=>({runIdeaPost:run}))
vi.mock('@/lib/auth/server',()=>({requirePermission:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}}})}})}))
import {maybeAutoPostIdea} from './idea-posting'
it('returns the Metricool error to the approval UI instead of silently dropping it',async()=>{
 run.mockResolvedValue({error:'Metricool API error: 401'})
 expect(await maybeAutoPostIdea('i')).toEqual({posted:false,skipped:'Metricool API error: 401'})
})
