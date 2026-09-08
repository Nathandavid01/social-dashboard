import {describe,it,expect,vi} from 'vitest'
const decide=vi.fn(async(_v:unknown)=>({error:'Verificación requerida'})),submit=vi.fn(async(_v:string)=>({error:'Sube una nueva versión'}))
vi.mock('@/lib/actions/pipeline-submit',()=>({decideReview:(v:unknown)=>decide(v),resubmitForReview:(v:string)=>submit(v)}))
import {approveIdea,requestRevision,submitIdeaForApproval} from './idea-approval'
describe('Legacy entry points preserve the verified workflow',()=>{
 it('approval without verification cannot bypass the shared gate',async()=>{expect((await approveIdea('i','v')).error).toBeTruthy();expect(decide).toHaveBeenCalledWith({ideaId:'i',decision:'approve',videoFileId:'v'})})
 it('preserves correction notes',async()=>{await requestRevision('i','Arregla los subtítulos');expect(decide).toHaveBeenCalledWith({ideaId:'i',decision:'request_changes',note:'Arregla los subtítulos'})})
 it('resubmission uses ownership and new-file checks',async()=>{expect((await submitIdeaForApproval('i')).error).toBeTruthy();expect(submit).toHaveBeenCalledWith('i')})
})
