import {it,expect,vi,beforeEach} from 'vitest'
const h=vi.hoisted(()=>({allowed:true,from:vi.fn(),read:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({currentUserHas:vi.fn(async()=>h.allowed)}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:h.from})}))
vi.mock('@/lib/utils/read-complete-pages',()=>({readCompletePages:h.read}))
import {getRecordingPendingTasks} from './recording-pending'
beforeEach(()=>{h.allowed=true;h.from.mockReset();h.read.mockReset()})
it('does not query recordings without access',async()=>{h.allowed=false;expect((await getRecordingPendingTasks()).error).toBeTruthy();expect(h.read).not.toHaveBeenCalled()})
it('reports incomplete query failures instead of zero tasks',async()=>{h.read.mockRejectedValue(new Error('partial'));expect((await getRecordingPendingTasks()).error).toBeTruthy()})
it('reads ideas for the selected sessions and reports all missing requirements',async()=>{h.read.mockResolvedValueOnce([{id:'s',title:'Client',session_date:'2026-09-10',status:'scheduled',client_id:null,client:null,videographer_id:null}]).mockResolvedValueOnce([]);vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-08T15:00:00Z'));try{const r=await getRecordingPendingTasks();expect(r.tasks[0].reasons).toEqual(['Vincular Cliente','Asignar Videógrafo','Definir Meta De Ideas']);expect(h.read).toHaveBeenCalledTimes(2)}finally{vi.useRealTimers()}})
