'use client'

import { useState } from 'react'
import { useRealtimeTasks } from '@/lib/hooks/use-realtime-tasks'
import type { Task, Client, Profile } from '@/lib/supabase/types'
import { TaskCard } from './task-card'
import { TaskForm } from './task-form'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, ClipboardList } from 'lucide-react'

interface TaskFeedProps {
  initialTasks: Task[]
  clients: Pick<Client, 'id' | 'name'>[]
  teamMembers: Pick<Profile, 'id' | 'full_name' | 'email'>[]
}

export function TaskFeed({ initialTasks, clients, teamMembers }: TaskFeedProps) {
  const tasks = useRealtimeTasks(initialTasks)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

  const filtered = tasks.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchType = typeFilter === 'all' || t.type === typeFilter
    return matchStatus && matchType
  })

  const grouped = {
    pending: filtered.filter((t) => t.status === 'pending'),
    in_progress: filtered.filter((t) => t.status === 'in_progress'),
    blocked: filtered.filter((t) => t.status === 'blocked'),
    completed: filtered.filter((t) => t.status === 'completed'),
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="content_creation">Content</SelectItem>
              <SelectItem value="scheduling">Scheduling</SelectItem>
              <SelectItem value="reporting">Reporting</SelectItem>
              <SelectItem value="client_call">Client Call</SelectItem>
              <SelectItem value="review">Review</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks found"
          description="Add a task to get started or adjust your filters."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {(['pending', 'in_progress', 'blocked', 'completed'] as const).map((status) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold capitalize">
                  {status.replace('_', ' ')}
                </h3>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {grouped[status].length}
                </span>
              </div>
              <div className="space-y-3">
                {grouped[status].length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">None</p>
                ) : (
                  grouped[status].map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskForm
        open={showForm}
        onOpenChange={setShowForm}
        clients={clients}
        teamMembers={teamMembers}
      />
    </>
  )
}
