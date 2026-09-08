import {beforeEach,it,expect,vi} from 'vitest'
const h=vi.hoisted(()=>({allowed:vi.fn(),create:vi.fn(),fail:false,count:0}))
vi.mock('@/lib/auth/server',()=>({currentUserHas:h.allowed}))
vi.mock('@/lib/supabase/server',()=>({createClient:h.create}))
import {getOperationsOverview} from './operations-overview'
beforeEach(()=>{
 vi.clearAllMocks();h.allowed.mockResolvedValue(true);h.fail=false;h.count=0
 h.create.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table:string){
 const q:any={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,single:async()=>({data:{status:'active',approval_status:'approved'},error:null}),then:(resolve:any)=>resolve({data:[],count:h.count,error:h.fail&&table==='content_ideas'?{message:'offline'}:null})};return q
 }})
})
it('rejects a viewer without team-overview permission before fetching any team data',async()=>{
 h.allowed.mockResolvedValue(false);expect(await getOperationsOverview()).toBeNull();expect(h.create).not.toHaveBeenCalled();expect(h.allowed).toHaveBeenCalledWith('operations.overview')
})
it('returns an error instead of a false zero-work dashboard when a query fails',async()=>{
 h.fail=true;const r=await getOperationsOverview();expect(r?.error).toContain('no se han contado');expect(r?.data).toBeUndefined()
})
it('returns a verified empty snapshot only when all queries succeed',async()=>{
 const r=await getOperationsOverview();expect(r?.error).toBeUndefined();expect(r?.data?.today).toEqual([])
})

it("does not show incomplete totals when the database caps its response",async()=>{h.count=1001;const r=await getOperationsOverview();expect(r?.error).toContain("sin verificar");expect(r?.data).toBeUndefined()})
