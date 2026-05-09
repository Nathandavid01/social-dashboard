'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task } from '@/lib/supabase/types'

export function useRealtimeTasks(initialTasks: Task[]) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)

  const fetchTask = useCallback(async (id: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tasks')
      .select(`
        *,
        client:clients!tasks_client_id_fkey(id, name),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)
      `)
      .eq('id', id)
      .single()
    return data
  }, [])

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        async (payload) => {
          const newTask = await fetchTask(payload.new.id)
          if (newTask) {
            setTasks((prev) => [newTask as Task, ...prev])
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        async (payload) => {
          const updatedTask = await fetchTask(payload.new.id)
          if (updatedTask) {
            setTasks((prev) =>
              prev.map((t) => (t.id === payload.new.id ? (updatedTask as Task) : t))
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks' },
        (payload) => {
          setTasks((prev) => prev.filter((t) => t.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTask])

  return tasks
}
