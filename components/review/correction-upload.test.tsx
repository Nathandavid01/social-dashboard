import {it,expect,vi,beforeEach} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
const h=vi.hoisted(()=>({owner:vi.fn(),register:vi.fn(),submit:vi.fn(),put:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('@/lib/actions/pipeline-submit',()=>({checkCorrectionOwner:h.owner,resubmitForReview:h.submit}))
vi.mock('@/lib/actions/entregas-r2',()=>({getEntregasUploadUrl:async()=>({url:'https://upload.example',key:'edited/key'}),registerEntregasVideo:h.register}))
import {CorrectionUpload} from './correction-upload'
beforeEach(()=>{vi.clearAllMocks();h.owner.mockResolvedValue({ok:true});h.register.mockResolvedValue({ok:true});h.submit.mockResolvedValue({ok:true});h.put.mockResolvedValue({ok:true});vi.stubGlobal('fetch',h.put)})
function send(){render(<CorrectionUpload ideaId="same-idea"/>);fireEvent.change(screen.getByLabelText('Video Corregido'),{target:{files:[new File(['video'],'fixed.mp4',{type:'video/mp4'})]}});fireEvent.click(screen.getByRole('button',{name:'Subir Corrección Y Enviar A Revisión'}))}
it('uploads and resubmits the same idea rather than creating a duplicate',async()=>{send();await waitFor(()=>expect(h.submit).toHaveBeenCalledWith('same-idea'));expect(h.register).toHaveBeenCalledWith(expect.objectContaining({ideaId:'same-idea',key:'edited/key'}))})
it('does not upload another editors correction',async()=>{h.owner.mockResolvedValue({error:'Pertenece a otro editor'});send();await screen.findByText('Pertenece a otro editor');expect(h.put).not.toHaveBeenCalled()})
it('does not resubmit a failed upload',async()=>{h.put.mockResolvedValue({ok:false});send();await screen.findByText('La subida falló. Intenta otra vez.');expect(h.submit).not.toHaveBeenCalled()})
