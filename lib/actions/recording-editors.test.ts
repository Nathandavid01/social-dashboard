import {it,expect,vi} from 'vitest'
const h=vi.hoisted(()=>({role:'editor',rpc:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({getEffectiveRole:async()=>h.role,getEffectiveUserId:async()=> 'me'}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({rpc:h.rpc})}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
import {saveRecordingEditors} from './recording-editors'
it('rejects editor self-assignment',async()=>{h.role='editor';expect((await saveRecordingEditors('s','c',[])).error).toBeTruthy();expect(h.rpc).not.toHaveBeenCalled()})
it('does not report a failed RPC as saved',async()=>{h.role='supervisor';h.rpc.mockResolvedValue({data:null,error:{message:'Missing migration'}});expect((await saveRecordingEditors('s','c',['e'])).error).toBeTruthy()})
