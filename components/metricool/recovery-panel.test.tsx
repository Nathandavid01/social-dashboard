import { expect,it,vi } from 'vitest'
import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const recover=vi.hoisted(()=>vi.fn(async()=>({ok:true})))
vi.mock('@/lib/actions/metricool-recovery',()=>({recoverMetricoolPost:recover}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
import { RecoveryPanel } from './recovery-panel'
it('verifies an explicit post ID and reports linkage without publishing',async()=>{
 render(<RecoveryPanel rows={[{id:'idea',title:'Video Del Cliente',posting_error:'Timeout'}]}/> )
 await userEvent.type(screen.getByLabelText('ID De Metricool'), '123')
 await userEvent.click(screen.getByRole('button',{name:'Verificar Y Vincular'}))
 expect(recover).toHaveBeenCalledWith('idea',123)
 expect(await screen.findByText(/vinculado sin crear/i)).toBeInTheDocument()
})
