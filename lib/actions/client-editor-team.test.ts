import {it,expect,vi} from 'vitest'
const h=vi.hoisted(()=>({rpc:vi.fn(async()=>({data:{ok:true},error:null})),role:'owner'}))
vi.mock('@/lib/auth/server',()=>({getEffectiveRole:async()=>h.role}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({rpc:h.rpc})}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
import {saveClientEditorTeam} from './client-editor-team'
it('assigns editors directly to a client without a recording session',async()=>{expect(await saveClientEditorTeam('client',['a','b','a'])).toEqual({ok:true});expect(h.rpc).toHaveBeenCalledWith('set_client_editors',{p_client_id:'client',p_editor_ids:['a','b']})})
it('does not allow an editor to assign clients',async()=>{h.role='editor';h.rpc.mockClear();expect(await saveClientEditorTeam('client',['a'])).toHaveProperty('error');expect(h.rpc).not.toHaveBeenCalled();h.role='owner'})
