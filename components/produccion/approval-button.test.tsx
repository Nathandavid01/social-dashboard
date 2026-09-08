import {describe,it,expect,vi,afterEach} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
vi.mock('@/components/auth/role-gate',()=>({useHasPermission:()=>true}))
vi.mock('@/lib/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
vi.mock('@/lib/actions/idea-approval',()=>({submitIdeaForApproval:vi.fn()}))
vi.mock('@/components/review/correction-upload',()=>({CorrectionUpload:({ideaId}:{ideaId:string})=><div>Corrección De {ideaId}</div>}))
import {ApprovalButton} from './approval-button'
afterEach(cleanup)
describe('Production routes through verified review',()=>{
 it('opens the review player instead of approving unseen media',()=>{render(<ApprovalButton ideaId="i" approvalStatus="submitted"/>);expect(screen.getByRole('link',{name:/revisar/i}).getAttribute('href')).toBe('/revision');expect(screen.queryByRole('button',{name:/aprobar/i})).toBeNull()})
 it('requires correction upload on the same video',()=>{render(<ApprovalButton ideaId="i" approvalStatus="revision_needed"/>);expect(screen.getByText('Corrección De i')).toBeTruthy()})
})
