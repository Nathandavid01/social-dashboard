import {beforeEach,expect,it,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
const h=vi.hoisted(()=>({fail:'',truncated:'',ideas:[] as any[],load:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{},currentUserHas:async()=>true}))
vi.mock('@/lib/actions/content-ideas',()=>({getIdeacionPipeline:async (options:any)=>{h.load(options);if(h.fail==='ideas')throw Error('offline');return h.ideas}}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,range:()=>q,then:(resolve:any)=>Promise.resolve(h.fail===table?{data:null,error:{message:'offline'}}:{data:[],count:h.truncated===table?1:0}).then(resolve)};return q}})}))
vi.mock('@/components/entregas/entregas-board',()=>({EntregasBoard:({ideas}:any)=> <div>Board {ideas.map((i:any)=>i.id).join(',')}</div>}))
vi.mock('@/components/onsite/supervisor-process-steps',()=>({SupervisorProcessSteps:()=>null}))
import Page from './page'
beforeEach(()=>{h.fail='';h.truncated='';h.load.mockClear();h.ideas=[{id:'valid',metricool_post_id:'post',videos:[{kind:'edited',storage_provider:'entregas-r2',status:'ready'}]}]})
it.each(['ideas','clients','entregas_client_review_items','content_idea_activity'])('shows recoverable error for %s',async source=>{
 h.fail=source
 render(await Page())
 expect(screen.getByRole('alert')).toBeInTheDocument()
 expect(screen.queryByText('Board valid')).not.toBeInTheDocument()
 expect(screen.getByRole('link',{name:'Volver A Cargar Entregas'})).toHaveAttribute('href','/entregas')
})
it.each(['clients','entregas_client_review_items','content_idea_activity'])('does not display truncated %s as complete',async source=>{
 h.truncated=source
 render(await Page())
 expect(screen.getByRole('alert')).toBeInTheDocument()
})
it('loads all ideas and excludes failed or archived uploads',async()=>{
 h.ideas.push(...['failed','archived'].map(status=>({id:status,videos:[{kind:'edited',storage_provider:'entregas-r2',status}]})))
 render(await Page())
 expect(h.load).toHaveBeenCalledWith({complete:true})
 expect(screen.getByText('Board valid')).toBeInTheDocument()
})
