import {it,expect,vi,afterEach} from 'vitest'
import {render,cleanup} from '@testing-library/react'
const h=vi.hoisted(()=>({role:'editor',channel:vi.fn()}))
vi.mock('@/lib/context/auth-context',()=>({useAuth:()=>({role:h.role})}))
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({channel:h.channel})}))
vi.mock('@/lib/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
vi.mock('next/navigation',()=>({usePathname:()=>'/mi-dia'}))
import {RequestNotifier} from './request-notifier'
import {VideoReviewNotifier} from './video-review-notifier'
afterEach(cleanup)
it('does not subscribe editors to global requests or reviews',()=>{render(<><RequestNotifier/><VideoReviewNotifier/></>);expect(h.channel).not.toHaveBeenCalled()})
