'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Notification, NotificationKind, NotificationSeverity } from '@/lib/supabase/types'

export async function getMyNotifications(limit = 30): Promise<Notification[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []) as Notification[]
}

export async function getMyUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function markAllNotificationsRead(): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteNotification(id: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

/**
 * Server-side helper to create a notification for a user.
 * Call from other server actions when something happens that warrants a ping.
 */
export async function createNotification(input: {
  userId: string
  kind: NotificationKind
  title: string
  body?: string | null
  link?: string | null
  severity?: NotificationSeverity
  meta?: Record<string, unknown>
}): Promise<{ ok?: true; id?: string; error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      severity: input.severity ?? 'info',
      meta: input.meta ?? {},
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/')
  return { ok: true, id: data.id }
}
