import {it,expect,vi} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('@/components/auth/role-gate',()=>({useHasPermission:()=>true}))
vi.mock('@/lib/actions/idea-videos-r2',()=>({getR2DownloadUrl:vi.fn()}))
vi.mock('@/lib/actions/entregas-r2',()=>({getEntregasDownloadUrl:vi.fn(),getEntregasUploadUrl:vi.fn(),registerEntregasVideo:vi.fn()}))
vi.mock('@/lib/actions/editor-delivery',()=>({checkEditorDelivery:vi.fn(),submitEditorDelivery:vi.fn()}))
import {EditorWorkPackage} from './editor-work-package'
const clip:any={ideaId:'idea',title:'Oferta',hook:'Guion de la idea',visualBrief:'Plano de producto',shootingNotes:'Usar toma dos',files:[{id:'r1',name:'Toma 1.mp4',kind:'raw',storageProvider:'r2'},{id:'r2',name:'Toma 2.mp4',kind:'raw',storageProvider:'r2'}]}
it('shows every source file, brief and client B-roll with an edited upload for the same idea',()=>{render(<EditorWorkPackage clip={clip} broll={[{id:'b',name:'Local.mp4',storageProvider:'r2',driveViewLink:null}]}/>);fireEvent.click(screen.getByText('Abrir Material Y Entregar'));expect(screen.getByText('Guion de la idea')).toBeInTheDocument();expect(screen.getByText('Toma 1.mp4')).toBeInTheDocument();expect(screen.getByText('Toma 2.mp4')).toBeInTheDocument();expect(screen.getByText('Local.mp4')).toBeInTheDocument();expect(screen.getByLabelText('Video Editado')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Enviar A Revisión'})).toBeDisabled()})

import {checkEditorDelivery,submitEditorDelivery} from '@/lib/actions/editor-delivery'
import {getEntregasUploadUrl,registerEntregasVideo} from '@/lib/actions/entregas-r2'
it('never submits for review after a failed upload',async()=>{
 vi.mocked(checkEditorDelivery).mockResolvedValue({ok:true});vi.mocked(getEntregasUploadUrl).mockResolvedValue({url:'https://upload.example/video',key:'key'});vi.stubGlobal('fetch',vi.fn(async()=>({ok:false})))
 render(<EditorWorkPackage clip={clip}/>);fireEvent.click(screen.getByText('Abrir Material Y Entregar'));fireEvent.change(screen.getByLabelText('Video Editado'),{target:{files:[new File(['video'],'edit.mp4',{type:'video/mp4'})]}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Enviar A Revisión'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('La Subida Falló'));expect(registerEntregasVideo).not.toHaveBeenCalled();expect(submitEditorDelivery).not.toHaveBeenCalled();vi.unstubAllGlobals()
})
it('uploads the edited file to the existing idea and sends that file to supervision',async()=>{
 vi.mocked(checkEditorDelivery).mockResolvedValue({ok:true});vi.mocked(getEntregasUploadUrl).mockResolvedValue({url:'https://upload.example/video',key:'entregas/idea/edited/cut.mp4'});vi.mocked(registerEntregasVideo).mockResolvedValue({ok:true,id:'edited-file'});vi.mocked(submitEditorDelivery).mockResolvedValue({ok:true});vi.stubGlobal('fetch',vi.fn(async()=>({ok:true})))
 render(<EditorWorkPackage clip={clip}/>);fireEvent.click(screen.getByText('Abrir Material Y Entregar'));fireEvent.change(screen.getByLabelText('Video Editado'),{target:{files:[new File(['video'],'edit.mp4',{type:'video/mp4'})]}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Enviar A Revisión'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Enviado A Revisión'));expect(registerEntregasVideo).toHaveBeenCalledWith(expect.objectContaining({ideaId:'idea'}));expect(submitEditorDelivery).toHaveBeenCalledWith('idea','edited-file');vi.unstubAllGlobals()
})
