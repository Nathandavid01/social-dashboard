'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getTaskComments(taskId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('task_comments')
    .select('id, content, created_at, updated_at, author:profiles(id, full_name, avatar_url)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) return { comments: [], error: error.message }
  return { comments: data ?? [], error: null }
}

export async function addTaskComment(taskId: string, content: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const trimmed = content.trim()
  if (!trimmed) return { error: 'El comentario no puede estar vacío.' }
  if (trimmed.length > 2000) return { error: 'Comentario demasiado largo (máx. 2000 caracteres).' }

  const { error } = await supabase.from('task_comments').insert({
    task_id: taskId,
    author_id: user.id,
    content: trimmed,
  })
  if (error) return { error: error.message }

  revalidatePath('/operations')
  return {}
}

export async function deleteTaskComment(commentId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { error } = await supabase
    .from('task_comments')
    .delete()
    .eq('id', commentId)
  if (error) return { error: error.message }

  revalidatePath('/operations')
  return {}
}
