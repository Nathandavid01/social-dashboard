import {expect,it,vi} from 'vitest'
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{}}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:()=>{const q:any={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>({data:null,error:{message:'read failed'}})};return q}})}))
import {getEnlaceCliente} from './entregas-client-review'
it('reports a failed link lookup instead of pretending no link exists',async()=>{
 expect(await getEnlaceCliente('i')).toEqual({error:'read failed'})
})
