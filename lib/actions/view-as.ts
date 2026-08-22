'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRole } from '@/lib/auth/server'
import {
  VIEW_AS_COOKIE,
  canStartViewAs,
  isViewAsEditorId,
  viewAsTargetOk,
} from '@/lib/auth/view-as-core'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 8,
  secure: process.env.NODE_ENV === 'production',
}

export interface ViewAsEditorOption {
  id: string
  full_name: string | null
}

export async function listEditorsForViewAs(): Promise<ViewAsEditorOption[]> {
  const role = await getCurrentRole()
  if (!canStartViewAs(role)) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'editor')
    .eq('status', 'active')
    .eq('approval_status', 'approved')
    .order('full_name')

  return data ?? []
}

export async function startViewAsEditor(editorId: string): Promise<{ ok?: true; error?: string }> {
  const role = await getCurrentRole()
  if (!canStartViewAs(role)) {
    return { error: 'Solo un admin puede ver como un editor.' }
  }
  if (!isViewAsEditorId(editorId)) {
    return { error: 'Editor no válido.' }
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, role, status, approval_status')
    .eq('id', editorId)
    .maybeSingle()

  if (!viewAsTargetOk(data)) {
    return { error: 'Esa persona no es un editor activo.' }
  }

  const store = await cookies()
  store.set(VIEW_AS_COOKIE, editorId, COOKIE_OPTS)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function stopViewAs(): Promise<{ ok?: true }> {
  const store = await cookies()
  store.delete(VIEW_AS_COOKIE)
  revalidatePath('/', 'layout')
  return { ok: true }
}
