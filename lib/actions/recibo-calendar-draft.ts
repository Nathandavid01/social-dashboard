'use server'

import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { belongsOnRecibo } from '@/lib/recibo/board-ideas'
import { editedEntregasVideoId } from '@/lib/recibo/preview'
import { reciboSpaceTone } from '@/lib/recibo/cadence-spaces'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { schedulePoolIdea } from './client-pool'

/** Eric 2026-10-18: an explicit calendar placement means draft, never publication. */
export async function draftReciboOnDate(input: {ideaId:string;clientId:string;videoId:string;date:string}):Promise<{ok?:true;error?:string}> {
  try { await requirePermission('posting.publish') } catch { return {error:'No autorizado para crear este borrador.'} }
  if (!input || ![input.ideaId,input.clientId,input.videoId,input.date].every(value=>typeof value==='string' && value.length>0)) return {error:'Faltan datos del contenido.'}
  const parsed=new Date(`${input.date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==input.date || input.date<todayISOInTimeZone('America/Puerto_Rico')) return {error:'Elige una fecha válida desde hoy.'}
  const supabase=await createClient()
  const {data,error}=await supabase.from('content_ideas').select('*, client:clients!content_ideas_client_id_fkey(status, edit_mode), videos:content_idea_videos!content_idea_videos_idea_id_fkey(*)').eq('id',input.ideaId).maybeSingle()
  if(error || !data) return {error:'No se pudo verificar el contenido actual.'}
  const idea=data as IdeaWithPipeline
  if(idea.client_id!==input.clientId) return {error:'El contenido pertenece a otro cliente.'}
  if(!belongsOnRecibo(idea) || data.posting_started_at || data.metricool_uuid) return {error:'Este contenido ya salió de Recibo o tiene un envío pendiente. Verifica Metricool.'}
  if(editedEntregasVideoId(idea)!==input.videoId) return {error:'Cambió el archivo editado. Actualiza antes de crear el borrador.'}
  if(reciboSpaceTone(idea)!=='approved') return {error:'Aprueba el contenido en Recibo antes de crear su borrador.'}
  return schedulePoolIdea({ideaId:input.ideaId,date:input.date,asDraft:true,expectedRecibo:{clientId:input.clientId,videoId:input.videoId}})
}
