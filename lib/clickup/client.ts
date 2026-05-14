const CLICKUP_BASE = 'https://api.clickup.com/api/v2'
const TOKEN = process.env.CLICKUP_API_TOKEN!

// Field IDs for Video Queue list
export const FIELD_IDS = {
  driveLink: '5d77dc39-032a-4156-b7c1-9c31e4753be8',
  cliente: 'fc3fa0c6-8fd4-46ab-b695-afd00806927c',
}

export const VIDEO_QUEUE_LIST_ID = '901416434640'

export interface ClickUpTask {
  id: string
  name: string
  description?: string
  status: { status: string }
  custom_fields: { id: string; name: string; value?: unknown; type: string }[]
  url: string
}

async function clickupFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${CLICKUP_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: TOKEN,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`ClickUp API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function getTask(taskId: string): Promise<ClickUpTask> {
  return clickupFetch<ClickUpTask>(`/task/${taskId}`)
}

export async function getVideoQueueTasks(): Promise<ClickUpTask[]> {
  const data = await clickupFetch<{ tasks: ClickUpTask[] }>(
    `/list/${VIDEO_QUEUE_LIST_ID}/task?archived=false&include_closed=false`
  )
  return data.tasks
}

export function extractTaskFields(task: ClickUpTask): {
  title: string
  driveLink: string | null
  clientName: string | null
} {
  const driveField = task.custom_fields.find((f) => f.id === FIELD_IDS.driveLink)
  const clientField = task.custom_fields.find((f) => f.id === FIELD_IDS.cliente)

  return {
    title: task.name,
    driveLink: driveField?.value ? String(driveField.value) : null,
    clientName: clientField?.value
      ? typeof clientField.value === 'object'
        ? (clientField.value as { name?: string })?.name ?? null
        : String(clientField.value)
      : null,
  }
}

export async function addCommentToTask(taskId: string, comment: string): Promise<void> {
  await clickupFetch(`/task/${taskId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ comment_text: comment, notify_all: false }),
  })
}

export async function registerWebhook(endpoint: string): Promise<{ id: string; webhook: { id: string } }> {
  const teamId = '90141070546'
  return clickupFetch(`/team/${teamId}/webhook`, {
    method: 'POST',
    body: JSON.stringify({
      endpoint,
      events: ['taskCreated'],
      list_id: VIDEO_QUEUE_LIST_ID,
    }),
  })
}
