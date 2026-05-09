'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { taskSchema, type TaskFormValues } from '@/lib/validations/task.schema'

export async function getTasks(filters?: { date?: string; assignee?: string }) {
  const supabase = await createClient()

  let query = supabase
    .from('tasks')
    .select(`
      *,
      client:clients!tasks_client_id_fkey(id, name),
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)
    `)
    .order('due_at', { ascending: true, nullsFirst: false })

  if (filters?.assignee) {
    query = query.eq('assignee_id', filters.assignee)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createTask(values: TaskFormValues) {
  const supabase = await createClient()
  const parsed = taskSchema.safeParse(values)
  if (!parsed.success) return { error: 'Invalid form data' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('tasks').insert({
    ...parsed.data,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/operations')
  return { success: true }
}

export async function updateTask(id: string, values: Partial<TaskFormValues>) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .update(values)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/operations')
  return { success: true }
}

export async function updateTaskStatus(id: string, status: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/operations')
  return { success: true }
}

export async function deleteTask(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('tasks').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/operations')
  return { success: true }
}
