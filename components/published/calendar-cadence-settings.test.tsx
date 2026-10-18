import {afterEach,it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
const h=vi.hoisted(()=>({allowed:true,save:vi.fn(async()=>({ok:true}))}))
vi.mock('@/components/auth/role-gate',()=>({useHasPermission:()=>h.allowed}))
vi.mock('@/lib/actions/client-cadence',()=>({updateClientCadence:h.save}))
vi.mock('@/lib/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
import {CalendarCadenceSettings} from './calendar-cadence-settings'
afterEach(()=>{cleanup();h.allowed=true;vi.clearAllMocks()})
it('configures the selected client from the calendar and reports saved weekdays',async()=>{
 const saved=vi.fn();render(<CalendarCadenceSettings client={{id:'c',name:'Cliente A',metricool_blog_id:'1',posting_days:[1],posting_time:'10:00'}} onSaved={saved}/>);fireEvent.click(screen.getByRole('button',{name:'Configurar frecuencia de Cliente A'}));expect(screen.getByRole('dialog')).toHaveTextContent('Cliente A');fireEvent.click(screen.getByRole('button',{name:'Miércoles'}));await waitFor(()=>expect(saved).toHaveBeenCalledWith(expect.objectContaining({posting_days:[1,3]})));expect(h.save).toHaveBeenCalledWith('c',expect.objectContaining({posting_days:[1,3]}))
})
it('does not expose configuration without cadence.edit',()=>{h.allowed=false;render(<CalendarCadenceSettings client={{id:'c',name:'Cliente A',metricool_blog_id:null}} onSaved={vi.fn()}/>);expect(screen.queryByRole('button')).toBeNull()})
