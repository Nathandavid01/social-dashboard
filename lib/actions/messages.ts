'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendSms, normalizePhone, getTwilioConfig } from '@/lib/integrations/twilio'

const sendSchema = z.object({
  body: z.string().min(1, 'Mensaje vacío').max(1500),
  triggerKind: z.enum(['manual', 'goal_reached', 'next_booking']).default('manual'),
})

export async function sendOwnerMessage(
  clientId: string,
  input: z.input<typeof sendSchema>,
): Promise<{ ok?: true; messageId?: string; error?: string }> {
  const parsed = sendSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const supabase = await createClient()
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('id, name, owner_name, owner_phone')
    .eq('id', clientId)
    .single()
  if (cErr || !client) return { error: cErr?.message ?? 'Cliente no encontrado' }

  const phone = normalizePhone(client.owner_phone)
  if (!phone) {
    return { error: 'El owner no tiene un teléfono válido. Agrégalo en el perfil del cliente.' }
  }

  const cfg = getTwilioConfig()
  const { data: { user } } = await supabase.auth.getUser()

  // Insert as queued first so we always have an audit row
  const { data: row, error: insErr } = await supabase
    .from('sent_messages')
    .insert({
      client_id: clientId,
      to_phone: phone,
      to_name: client.owner_name,
      body: parsed.data.body,
      channel: 'sms',
      status: cfg ? 'queued' : 'failed',
      trigger_kind: parsed.data.triggerKind,
      sent_by: user?.id ?? null,
      error_message: cfg ? null : 'Twilio no configurado',
    })
    .select('id')
    .single()
  if (insErr) return { error: insErr.message }

  if (!cfg) {
    return { error: 'Twilio no está configurado en este entorno. Mensaje quedó registrado como fallido.' }
  }

  const res = await sendSms({ to: phone, body: parsed.data.body })
  await supabase
    .from('sent_messages')
    .update({
      status: res.error ? 'failed' : 'sent',
      provider_message_id: res.sid ?? null,
      error_message: res.error ?? null,
    })
    .eq('id', row.id)

  revalidatePath(`/clients/${clientId}`)
  if (res.error) return { error: res.error }
  return { ok: true, messageId: row.id }
}

export async function getClientMessages(clientId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sent_messages')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(error.message)
  return data ?? []
}
