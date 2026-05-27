'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ClientRequest } from '@/lib/supabase/types'

export async function updateRequestStatus(
  id: string,
  status: ClientRequest['status'],
  notes?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const update: Record<string, unknown> = { status }
  if (notes !== undefined) update.notes = notes

  const { error } = await supabase.from('client_requests').update(update).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/operations')
  return {}
}

export async function convertRequestToTask(
  requestId: string,
): Promise<{ error?: string; taskId?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { data: req, error: reqError } = await supabase
    .from('client_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (reqError || !req) return { error: 'Solicitud no encontrada.' }
  if (req.status === 'converted') return { error: 'Ya fue convertida.' }

  // Try to match client by company name
  const { data: matchedClients } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', `%${req.company_name}%`)
    .limit(1)

  const clientId = matchedClients?.[0]?.id ?? null

  const urgencyToPriority: Record<string, number> = {
    urgent: 1,
    high: 1,
    normal: 2,
    low: 3,
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      title: `[Portal] ${req.company_name} — ${req.request_type}`,
      description: `${req.description}\n\n— Solicitado por: ${req.contact_name}${req.contact_email ? ` (${req.contact_email})` : ''}${req.contact_phone ? ` · ${req.contact_phone}` : ''}`,
      type: mapRequestType(req.request_type),
      client_id: clientId,
      assignee_id: null,
      status: 'pending',
      priority: urgencyToPriority[req.urgency] ?? 2,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (taskError || !task) return { error: taskError?.message ?? 'Error creando tarea.' }

  await supabase
    .from('client_requests')
    .update({ status: 'converted', task_id: task.id })
    .eq('id', requestId)

  revalidatePath('/operations')
  revalidatePath('/home')

  return { taskId: task.id }
}

function mapRequestType(requestType: string): string {
  const map: Record<string, string> = {
    content: 'content_creation',
    design: 'content_creation',
    caption: 'content_creation',
    scheduling: 'scheduling',
    report: 'reporting',
    call: 'client_call',
    campaign: 'content_creation',
    other: 'other',
  }
  return map[requestType] ?? 'other'
}
