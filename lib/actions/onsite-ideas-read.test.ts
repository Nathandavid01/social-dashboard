import {beforeEach,expect,it,vi} from 'vitest'
const h=vi.hoisted(()=>({response:{} as any}))
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{}}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:()=>{const q:any={select:()=>q,eq:()=>q,single:async()=>h.response};return q}})}))
import {getAddableIdeas} from './onsite'
beforeEach(()=>{h.response={data:{client_id:null},error:null}})
it('returns an empty list only for a successfully loaded unlinked session',async()=>expect(await getAddableIdeas('s')).toEqual({ideas:[]}))
it('reports a failed session lookup',async()=>{
 h.response={data:null,error:{message:'offline'}}
 expect(await getAddableIdeas('s')).toHaveProperty('error')
})
it('reports an absent session',async()=>{
 h.response={data:null,error:null}
 expect(await getAddableIdeas('s')).toHaveProperty('error')
})
