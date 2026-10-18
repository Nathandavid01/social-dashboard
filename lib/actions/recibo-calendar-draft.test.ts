import { beforeEach, expect, it, vi } from 'vitest'
const { schedule, permission, read } = vi.hoisted(()=>({schedule:vi.fn(),permission:vi.fn(),read:vi.fn()}))
vi.mock('@/lib/actions/client-pool',()=>({schedulePoolIdea:schedule}))
vi.mock('@/lib/auth/server',()=>({requirePermission:permission}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:read})})})})}))
import { draftReciboOnDate } from './recibo-calendar-draft'
const input={ideaId:'i',clientId:'c',videoId:'v',date:'2099-10-20'}
beforeEach(()=>{vi.resetAllMocks();schedule.mockResolvedValue({ok:true,draft:true});read.mockResolvedValue({data:{id:'i',client_id:'c',status:'producida',staff_client_approval:'approved',client:{status:'active',edit_mode:'ai'},videos:[{id:'v',kind:'edited',status:'uploaded',storage_provider:'entregas-r2',drive_file_id:'k',name:'pizza.png'}]}})})
it('creates only a draft on the exact requested day',async()=>{expect(await draftReciboOnDate(input)).toMatchObject({ok:true});expect(permission).toHaveBeenCalledWith('posting.publish');expect(schedule).toHaveBeenCalledWith({ideaId:'i',date:input.date,asDraft:true,expectedRecibo:{clientId:'c',videoId:'v'}})})
it('rejects another client before sending',async()=>{expect(await draftReciboOnDate({...input,clientId:'other'})).toHaveProperty('error');expect(schedule).not.toHaveBeenCalled()})
it('rejects replaced media',async()=>{expect(await draftReciboOnDate({...input,videoId:'old'})).toHaveProperty('error');expect(schedule).not.toHaveBeenCalled()})
it('rejects old or malformed calendar dates',async()=>{for(const date of ['2020-01-01','2099-02-31','bad'])expect(await draftReciboOnDate({...input,date})).toHaveProperty('error');expect(schedule).not.toHaveBeenCalled()})
it('rejects already linked content rather than rescheduling',async()=>{const row=await read();read.mockResolvedValue({data:{...row.data,metricool_post_id:4}});expect(await draftReciboOnDate(input)).toHaveProperty('error');expect(schedule).not.toHaveBeenCalled()})
it('rejects denied permission before data access',async()=>{permission.mockRejectedValue(Error('No autorizado'));expect(await draftReciboOnDate(input)).toHaveProperty('error');expect(read).not.toHaveBeenCalled()})
it('keeps unconfirmed remote results as an error',async()=>{schedule.mockResolvedValue({error:'Verifica Metricool antes de reenviar'});expect(await draftReciboOnDate(input)).toHaveProperty('error','Verifica Metricool antes de reenviar')})
