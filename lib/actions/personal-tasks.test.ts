import {it,expect,vi,beforeEach} from 'vitest'
const h=vi.hoisted(()=>({allow:false,queries:[] as string[],insert:vi.fn(),eq:vi.fn(),read:vi.fn(),single:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({currentUserHas:async()=>h.allow,getEffectiveUserId:async()=> 'me'}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'me'}}})},from:(table:string)=>{h.queries.push(table);const q:any={select:()=>q,eq:(...a:any[])=>{h.eq(...a);return q},order:()=>q,in:()=>q,range:()=>q,update:()=>q,maybeSingle:h.single,single:h.single,insert:h.insert,then:(r:any)=>r({data:[],error:null})};return q}})}))
vi.mock('@/lib/utils/read-complete-pages',()=>({readCompletePages:async(fn:any)=>{fn(0,499);return h.read()}}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
import {getPersonalTasks,assignPersonalTask,setPersonalTaskStatus} from './personal-tasks'
beforeEach(()=>{h.allow=false;h.queries=[];h.insert.mockReset();h.eq.mockClear();h.read.mockResolvedValue([]);h.single.mockResolvedValue({data:null,error:null})})
it('filters personal work by the effective user and does not list other people',async()=>{await getPersonalTasks();expect(h.eq).toHaveBeenCalledWith('assignee_id','me');expect(h.queries).not.toContain('profiles')})
it('refuses assignment without create permission',async()=>{expect((await assignPersonalTask({})).error).toBeTruthy();expect(h.insert).not.toHaveBeenCalled()})
it('validates assignment fields before saving',async()=>{h.allow=true;expect((await assignPersonalTask({title:' ',assignee_id:'bad'})).error).toBeTruthy();expect(h.insert).not.toHaveBeenCalled()})
it('does not hide load failure as an empty personal list',async()=>{h.read.mockRejectedValue(new Error('failed'));expect((await getPersonalTasks()).error).toBeTruthy()})

it('saves assignment and then sends a notification to that exact person',async()=>{
 h.allow=true;h.single.mockResolvedValue({data:{id:'11111111-1111-4111-8111-111111111111'},error:null});h.insert.mockResolvedValue({error:null})
 const result=await assignPersonalTask({id:'22222222-2222-4222-8222-222222222222',title:'Preparar Ideas',description:'Seis ideas',assignee_id:'11111111-1111-4111-8111-111111111111',due_at:'2026-09-09T17:00:00-04:00',priority:1})
 expect(result.ok).toBe(true);expect(h.insert).toHaveBeenNthCalledWith(1,expect.objectContaining({assignee_id:'11111111-1111-4111-8111-111111111111',created_by:'me',status:'pending'}));expect(h.insert).toHaveBeenNthCalledWith(2,expect.objectContaining({user_id:'11111111-1111-4111-8111-111111111111',kind:'task_assigned'}))
})
it('does not allow a regular user to update someone else task or claim success for no row',async()=>{
 const result=await setPersonalTaskStatus('22222222-2222-4222-8222-222222222222','completed');expect(h.eq).toHaveBeenCalledWith('assignee_id','me');expect(result.error).toBeTruthy()
})
const valid={id:'22222222-2222-4222-8222-222222222222',title:'Preparar Ideas',description:'Seis ideas',assignee_id:'11111111-1111-4111-8111-111111111111',due_at:'2026-09-09T17:00:00-04:00',priority:1}
it('rejects an unavailable assignee before writing',async()=>{h.allow=true;const result=await assignPersonalTask(valid);expect(result.error).toContain('Activa');expect(h.insert).not.toHaveBeenCalled()})
it('reports a notification failure separately from the saved assignment',async()=>{h.allow=true;h.single.mockResolvedValue({data:{id:valid.assignee_id},error:null});h.insert.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({error:{message:'RLS'}});const result=await assignPersonalTask(valid);expect(result.ok).toBe(true);expect(result.warning).toBeTruthy()})
it('reconciles the same saved request without inserting another task or notification',async()=>{h.allow=true;h.single.mockResolvedValueOnce({data:{id:valid.assignee_id},error:null}).mockResolvedValueOnce({data:{...valid,created_by:'me'},error:null});h.insert.mockResolvedValueOnce({error:{code:'23505'}});const result=await assignPersonalTask(valid);expect(result.ok).toBe(true);expect(h.insert).toHaveBeenCalledTimes(1)})
