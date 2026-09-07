import { describe,it,expect,vi } from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
const audit=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/actions/publication-audit',()=>({auditUpcomingPublications:audit}))
import {PublicationAuditPanel} from './publication-audit-panel'
describe('publication readiness panel',()=>{
 it('shows drafts separately and explains they will not publish',async()=>{
  audit.mockResolvedValue({report:{start:'2026-09-08',end:'2026-09-21',checkedAt:'2026-09-07T14:00:00Z',rows:[{id:'1',name:'Arasibo',planned:0,drafts:3,scheduled:0,failed:0,manual:0,published:0}]}})
  render(<PublicationAuditPanel />)
  fireEvent.click(screen.getByRole('button',{name:/Verificar/i}))
  expect(await screen.findByText('Arasibo')).toBeInTheDocument()
  expect(screen.getByText(/Los borradores no se publican/)).toBeInTheDocument()
 })
})
