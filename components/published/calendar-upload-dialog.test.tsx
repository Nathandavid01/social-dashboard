import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { render,screen,fireEvent,waitFor,cleanup } from '@testing-library/react'
const h=vi.hoisted(()=>({prepare:vi.fn(),finish:vi.fn(),upload:vi.fn(),allowed:true}))
vi.mock('@/lib/actions/calendar-upload',()=>({prepareCalendarUpload:h.prepare,finishCalendarUpload:h.finish,getCalendarImageUploadUrl:vi.fn(async()=>({url:'https://signed.example/photo',key:'entregas/idea/edited/photo.jpg'}))}))
vi.mock('@/lib/utils/entregas-fast-upload',()=>({uploadEntregasFileFast:h.upload}))
vi.mock('@/lib/utils/upload-http',()=>({putBlob:vi.fn()}))
vi.mock('@/components/auth/role-gate',()=>({useHasPermission:()=>h.allowed}))
vi.mock('@/lib/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
import { CalendarUploadDialog } from './calendar-upload-dialog'
const clients=[{id:'c',name:'Cliente A',metricool_blog_id:'1',platforms:['instagram']},{id:'d',name:'Cliente B',metricool_blog_id:'2',platforms:['facebook']}]
beforeEach(()=>{vi.clearAllMocks();h.allowed=true;h.prepare.mockResolvedValue({ok:true,ideaId:'idea'});h.upload.mockResolvedValue({key:'entregas/idea/edited/video.mp4'});h.finish.mockResolvedValue({ok:true,confirmed:true,postId:77,dateTime:'2099-10-20T10:30',clientId:'c'})})
afterEach(cleanup)
async function fill(){fireEvent.change(screen.getByLabelText('Archivo'),{target:{files:[new File(['video'],'corte.mp4',{type:'video/mp4'})]}});fireEvent.change(screen.getByLabelText('Caption'),{target:{value:'Nuestro post'}})}
it('uploads inside the client calendar and saves a draft without auto-publishing',async()=>{
 const saved=vi.fn();render(<CalendarUploadDialog clients={clients} clientId="c" initialDateTime="2099-10-20T10:30" onSaved={saved}/>);
 fireEvent.click(screen.getByRole('button',{name:'Subir contenido'}));expect(screen.queryByLabelText('Cliente')).toBeNull();expect(screen.getByRole('dialog')).toHaveTextContent('Cliente A');await fill();fireEvent.click(screen.getByRole('button',{name:'Subir y guardar borrador'}));
 await waitFor(()=>expect(saved).toHaveBeenCalledWith(expect.objectContaining({clientId:'c',dateTime:'2099-10-20T10:30'})))
 expect(h.prepare).toHaveBeenCalledWith(expect.objectContaining({clientId:'c',caption:'Nuestro post',platforms:['instagram']}));expect(h.upload).toHaveBeenCalled();expect(h.finish).toHaveBeenCalledWith(expect.objectContaining({ideaId:'idea',fileName:'corte.mp4'}))
})
it('keeps the completed upload on rejection so retry does not re-upload or create another idea',async()=>{
 h.finish.mockResolvedValueOnce({error:'Revisa las redes'}).mockResolvedValueOnce({ok:true,confirmed:true,postId:77,clientId:'c',dateTime:'2099-10-20T10:30'})
 render(<CalendarUploadDialog clients={clients} clientId="c" initialDateTime="2099-10-20T10:30" onSaved={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'Subir contenido'}));await fill();fireEvent.click(screen.getByRole('button',{name:'Subir y guardar borrador'}));await screen.findByText('Revisa las redes');fireEvent.click(screen.getByRole('button',{name:'Guardar borrador nuevamente'}));await waitFor(()=>expect(h.finish).toHaveBeenCalledTimes(2));expect(h.prepare).toHaveBeenCalledTimes(1);expect(h.upload).toHaveBeenCalledTimes(1)
})
it('blocks replay after an uncertain response and exposes verification',async()=>{
 h.finish.mockResolvedValue({error:'Verifica Metricool',uncertain:true});const verify=vi.fn();render(<CalendarUploadDialog clients={clients} clientId="c" onSaved={vi.fn()} onVerify={verify}/>);fireEvent.click(screen.getByRole('button',{name:'Subir contenido'}));await fill();fireEvent.click(screen.getByRole('button',{name:'Subir y guardar borrador'}));await screen.findByText('Verifica Metricool');expect(screen.getByRole('button',{name:'Guardar borrador nuevamente'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Verificar calendario'}));expect(verify).toHaveBeenCalled()
})
it('does not offer uploads to an unauthorized role',()=>{h.allowed=false;render(<CalendarUploadDialog clients={clients} clientId="c" onSaved={vi.fn()}/>);expect(screen.queryByRole('button',{name:'Subir contenido'})).toBeNull()})

it('puts an image directly to its signed storage URL and creates its draft after the upload',async()=>{
 const {putBlob}=await import('@/lib/utils/upload-http');const saved=vi.fn()
 render(<CalendarUploadDialog clients={clients} clientId="c" initialDateTime="2099-10-20T10:30" onSaved={saved}/>)
 fireEvent.click(screen.getByRole('button',{name:'Subir contenido'}));fireEvent.change(screen.getByLabelText('Archivo'),{target:{files:[new File(['photo'],'photo.jpg',{type:'image/jpeg'})]}});fireEvent.change(screen.getByLabelText('Caption'),{target:{value:'La foto'}});fireEvent.click(screen.getByRole('button',{name:'Subir y guardar borrador'}))
 await waitFor(()=>expect(saved).toHaveBeenCalled())
 expect(putBlob).toHaveBeenCalledWith('https://signed.example/photo',expect.any(File),'image/jpeg',expect.objectContaining({onProgress:expect.any(Function)}))
 expect(h.upload).not.toHaveBeenCalled();expect(h.finish).toHaveBeenCalledWith(expect.objectContaining({key:'entregas/idea/edited/photo.jpg'}))
})

it('retains the original client after a failed upload and blocks retry in another calendar',async()=>{
 h.finish.mockResolvedValue({error:'Revisa las redes'});const saved=vi.fn(),verify=vi.fn()
 const view=render(<CalendarUploadDialog clients={clients} clientId="c" onSaved={saved} onVerify={verify}/>);
 fireEvent.click(screen.getByRole('button',{name:'Subir contenido'}));await fill();fireEvent.click(screen.getByRole('button',{name:'Subir y guardar borrador'}));await screen.findByText('Revisa las redes');
 fireEvent.click(screen.getByRole('button',{name:'Close'}));view.rerender(<CalendarUploadDialog clients={clients} clientId="d" onSaved={saved} onVerify={verify}/>);fireEvent.click(screen.getByRole('button',{name:'Subir contenido'}));
 expect(screen.getByRole('dialog')).toHaveTextContent('Subir al calendario · Cliente A');expect(screen.getByRole('button',{name:'Guardar borrador nuevamente'})).toBeDisabled();expect(screen.getByLabelText('instagram')).toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Verificar calendario'}));expect(verify).toHaveBeenCalledWith(expect.objectContaining({clientId:'c'}));
 view.rerender(<CalendarUploadDialog clients={clients} clientId="c" onSaved={saved} onVerify={verify}/>);fireEvent.click(screen.getByRole('button',{name:'Subir contenido'}));fireEvent.click(screen.getByRole('button',{name:'Guardar borrador nuevamente'}));await waitFor(()=>expect(h.finish).toHaveBeenCalledTimes(2));expect(h.prepare).toHaveBeenCalledTimes(1);expect(h.upload).toHaveBeenCalledTimes(1)
})
