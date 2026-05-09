import { createClient } from '@/lib/supabase/server'
import { getTasks } from '@/lib/actions/tasks'
import { TaskFeed } from '@/components/operations/task-feed'
import { PageHeader } from '@/components/shared/page-header'
import { format } from 'date-fns'

export default async function OperationsPage() {
  const supabase = await createClient()

  const [tasks, { data: clients }, { data: teamMembers }] = await Promise.all([
    getTasks(),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Board"
        description={`Today — ${format(new Date(), 'EEEE, MMMM d')}`}
      />
      <TaskFeed
        initialTasks={tasks}
        clients={clients ?? []}
        teamMembers={teamMembers ?? []}
      />
    </div>
  )
}
