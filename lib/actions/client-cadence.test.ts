import {beforeEach,it,expect,vi} from 'vitest'
const h=vi.hoisted(()=>({allowed:true,db:vi.fn(),update:vi.fn(),sync:vi.fn(),path:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({currentUserHas:vi.fn(async()=>h.allowed)}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>{h.db();return {from:()=>({update:(patch:any)=>{h.update(patch);return {eq:async()=>({error:null})}}})}}}))
vi.mock('@/lib/actions/sync-posting-cadence',()=>({syncSchedulesToPostingDays:h.sync}))
vi.mock('next/cache',()=>({revalidatePath:h.path,revalidateTag:vi.fn()}))
import {updateClientCadence} from './client-cadence'
beforeEach(()=>{vi.clearAllMocks();h.allowed=true})
it('denies frequency edits before accessing storage without cadence.edit',async()=>{h.allowed=false;expect(await updateClientCadence('c',{posting_days:[1]})).toEqual({error:'No autorizado'});expect(h.db).not.toHaveBeenCalled()})
it('preserves legacy formats on selected days and refreshes Recibos and the client calendar',async()=>{expect(await updateClientCadence('c',{posting_days:[1,3],posting_time:'10:00',posting_schedule:{1:'reel',3:'16:00',5:'post',6:'25:00'}})).toEqual({ok:true});expect(h.update).toHaveBeenCalledWith(expect.objectContaining({posting_days:[1,3],posting_time:'10:00',posting_schedule:{1:'reel',3:'16:00'}}));expect(h.sync).toHaveBeenCalledWith(expect.anything(),'c',[1,3]);expect(h.path).toHaveBeenCalledWith('/recibo');expect(h.path).toHaveBeenCalledWith('/clients/c/calendar')})
