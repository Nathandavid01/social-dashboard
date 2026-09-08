import {beforeEach,expect,it,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
const h=vi.hoisted(()=>({ fail:'' }))
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{},getEffectiveRole:async()=> 'supervisor',getEffectiveUserId:async()=> 'u',currentUserHas:async()=>true}))
vi.mock('@/lib/actions/content-ideas',()=>({getIdeacionPipeline:async()=>{if(h.fail==='ideas')throw Error('offline');return [{id:'i',client_id:'c',approval_status:'revision_needed',videos:[{kind:'edited',storage_provider:'entregas-r2'}]}]}}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,then:(resolve:any)=>Promise.resolve(h.fail===table?{data:null,error:{message:'offline'}}:{data:[]}).then(resolve)};return q}})}))
vi.mock('@/components/entregas/entregas-board',()=>({EntregasBoard:()=> <div>Review Board</div>}))
vi.mock('@/components/entregas/vista-editor',()=>({VistaEditor:()=> <div>Editor</div>}))
vi.mock('@/components/onsite/supervisor-process-steps',()=>({SupervisorProcessSteps:()=>null}))
import Page from './page'
beforeEach(()=>{h.fail=''})
it.each(['ideas','clients','content_idea_activity'])('does not show a misleading queue when %s fails',async source=>{
 h.fail=source
 render(await Page())
 expect(screen.getByRole('alert')).toBeInTheDocument()
 expect(screen.queryByText('Review Board')).not.toBeInTheDocument()
 expect(screen.getByRole('link',{name:'Volver A Cargar Revisión'})).toHaveAttribute('href','/revision')
})
it('shows the loaded queue',async()=>{render(await Page());expect(screen.getByText('Review Board')).toBeInTheDocument()})
