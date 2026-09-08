import { beforeEach, expect, it, vi } from 'vitest'
const h=vi.hoisted(()=>({rows:[] as any[],error:null as any,count:0,user:{id:'u'} as {id:string}|null}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:h.user}})},from:()=>{
 const q:any={select:()=>q,order:()=>q,limit:()=>q,then:(resolve:any)=>resolve({data:h.rows,error:h.error,count:h.count})};return q
}})}))
import { getAlerts } from './alerts'
beforeEach(()=>{h.rows=[];h.error=null;h.count=0;h.user={id:'u'}})
it('preserves a verified empty result',async()=>expect(await getAlerts()).toEqual([]))
it('does not return expired or dismissed alerts even if supplied by the data layer',async()=>{
 h.rows=[{id:'expired',expires_at:'2000-01-01T00:00:00Z'},{id:'dismissed',dismissed_by:['u']},{id:'active',expires_at:null}];h.count=3
 expect(await getAlerts()).toEqual([{id:'active',expires_at:null}])
})
it('rejects partial results instead of hiding unseen critical alerts',async()=>{
 h.count=1001;h.rows=[{id:'info'}]
 await expect(getAlerts()).rejects.toThrow(/incompleta/i)
})
it('fails on a database error',async()=>{h.error={message:'offline'};await expect(getAlerts()).rejects.toThrow()})
it('requires a signed-in viewer',async()=>{h.user=null;await expect(getAlerts()).rejects.toThrow()})
