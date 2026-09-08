import {beforeEach,expect,it,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
const h=vi.hoisted(()=>({shots:{} as any,ideas:{} as any}))
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{},currentUserHas:async()=>true,getEffectiveUserId:async()=> 'u'}))
vi.mock('@/lib/actions/onsite',()=>({getOnsiteSessions:async()=>({sessions:[{id:'s'}]}),getOnsiteShots:async()=>h.shots,getAddableIdeas:async()=>h.ideas}))
vi.mock('@/lib/onsite/slot-count',()=>({pickOnsiteSession:()=>({id:'s'})}))
vi.mock('@/components/onsite/onsite-studio',()=>({OnsiteStudio:()=> <div>Call Sheet</div>}))
vi.mock('@/components/onsite/supervisor-process-steps',()=>({SupervisorProcessSteps:()=>null}))
import Page from './page'
beforeEach(()=>{h.shots={shots:[]};h.ideas={ideas:[]}})
it.each(['shots','ideas'] as const)('shows a recoverable error instead of an empty call sheet when %s fails',async key=>{
 h[key]={error:'offline'}
 render(await Page({searchParams:Promise.resolve({s:'s'})}))
 expect(screen.getByRole('alert')).toBeInTheDocument()
 expect(screen.queryByText('Call Sheet')).not.toBeInTheDocument()
 expect(screen.getByRole('link',{name:'Volver A Cargar La Sesión'})).toHaveAttribute('href','/onsite?s=s')
})
it('renders a genuinely empty loaded session',async()=>{
 render(await Page({searchParams:Promise.resolve({s:'s'})}))
 expect(screen.getByText('Call Sheet')).toBeInTheDocument()
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
