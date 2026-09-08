import { beforeEach, expect, it, vi } from 'vitest'
const h=vi.hoisted(()=>({user:'me' as string|null,allowed:false,eq:vi.fn(),read:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({currentUserHas:async()=>h.allowed}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:h.user?{id:h.user}:null}})},from:()=>{h.read();const q:any={select:()=>q,eq:(...a:any[])=>{h.eq(...a);return q},gte:()=>q,not:()=>q,order:()=>q,limit:()=>q,single:async()=>({data:{status:'active',approval_status:'approved'}}),then:(r:any)=>r({data:[],error:null})};return q}})}))
import { getAssignedRecordings } from './assigned-recordings'
beforeEach(()=>{vi.clearAllMocks();h.user='me';h.allowed=false})
it('filters the personal agenda by authenticated user',async()=>{await getAssignedRecordings();expect(h.eq).toHaveBeenCalledWith('videographer_id','me')})
it('denies another members agenda without team access',async()=>{expect(await getAssignedRecordings('other')).toBeNull();expect(h.read).not.toHaveBeenCalled()})
it('denies anonymous callers',async()=>{h.user=null;expect(await getAssignedRecordings()).toBeNull()})
