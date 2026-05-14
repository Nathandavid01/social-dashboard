import { NextRequest, NextResponse } from 'next/server'
import { getVideoQueueTasks } from '@/lib/clickup/client'
import { processClickUpTask } from '@/lib/automation/process-task'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const taskId = body.task_id

    // Process a single specific task
    if (taskId) {
      const result = await processClickUpTask(taskId)
      return NextResponse.json(result)
    }

    // Process all tasks in the Video Queue
    const tasks = await getVideoQueueTasks()
    if (tasks.length === 0) {
      return NextResponse.json({ message: 'No tasks in Video Queue', results: [] })
    }

    const results = await Promise.allSettled(
      tasks.map((t) => processClickUpTask(t.id))
    )

    const summary = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { success: false, error: String(r.reason) }
    )

    return NextResponse.json({ processed: tasks.length, results: summary })
  } catch (error) {
    console.error('Process queue error:', error)
    return NextResponse.json({ error: 'Failed to process queue' }, { status: 500 })
  }
}

export async function GET() {
  const tasks = await getVideoQueueTasks()
  return NextResponse.json({ count: tasks.length, tasks: tasks.map((t) => ({ id: t.id, name: t.name })) })
}
