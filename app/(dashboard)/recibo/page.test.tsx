import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
const h=vi.hoisted(()=>({allowed:true,permission:vi.fn(),select:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({requirePermission:h.permission,currentUserHas:vi.fn(async()=>h.allowed)}))
vi.mock('@/lib/actions/content-ideas',()=>({getIdeacionPipeline:vi.fn(async()=>[])}))
vi.mock('@/lib/recibo/load-published-videos',()=>({loadPublishedVideoCounts:vi.fn(async()=>({total:0,byClient:{}}))}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:null}})},from:()=>{let columns='';const q:any={select:(s:string)=>{columns=s;h.select(s);return q},eq:()=>q,order:()=>q,in:()=>q,then:(resolve:any)=>Promise.resolve({data:columns.includes('default_platforms')?[{id:'c',name:'Cliente A',metricool_blog_id:'1',platforms:['instagram']}]:[]}).then(resolve)};return q}})}))
vi.mock('@/components/recibo/recibo-board',()=>({ReciboBoard:()=> <div>Contenido recibido existente</div>}))
vi.mock('@/components/recibo/recibo-published-sync',()=>({ReciboPublishedSync:()=>null}))
vi.mock('@/components/published/content-calendar',()=>({ContentCalendar:({clients}:any)=><div>Calendario: {clients[0]?.name}</div>}))
import Page from './page'
beforeEach(()=>{h.allowed=true;vi.clearAllMocks()});afterEach(cleanup)
it('loads the client posting calendar directly inside Recibos with its upload network metadata',async()=>{render(await Page());expect(h.permission).toHaveBeenCalledWith('entregas.read');expect(screen.getByText('Calendario: Cliente A')).toBeVisible();expect(h.select).toHaveBeenCalledWith('id, name, metricool_blog_id, platforms, default_platforms, posting_days, posting_time, posting_schedule')})
it('does not query or render Metricool calendars for an unauthorized viewer',async()=>{h.allowed=false;render(await Page());expect(screen.getByText('Contenido recibido existente')).toBeVisible();expect(h.select).not.toHaveBeenCalledWith('id, name, metricool_blog_id, platforms, default_platforms, posting_days, posting_time, posting_schedule');expect(screen.queryByRole('tab',{name:'Calendario'})).toBeNull()})
