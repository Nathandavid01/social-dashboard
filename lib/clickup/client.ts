const CLICKUP_BASE = 'https://api.clickup.com/api/v2'
const TOKEN = process.env.CLICKUP_API_TOKEN!

// Field IDs for Video Queue list
export const FIELD_IDS = {
  driveLink: '5d77dc39-032a-4156-b7c1-9c31e4753be8',
  clientName: 'ac77d5c0-8965-4dc5-b49b-7a9a2177481f',
  cliente: 'fc3fa0c6-8fd4-46ab-b695-afd00806927c', // legacy dropdown, kept for fallback
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
  // Prefer text "Client Name" field; fall back to legacy dropdown "Cliente"
  const clientTextField = task.custom_fields.find((f) => f.id === FIELD_IDS.clientName)
  const clientDropField = task.custom_fields.find((f) => f.id === FIELD_IDS.cliente)

  let clientName: string | null = null
  if (clientTextField?.value) {
    clientName = String(clientTextField.value).trim() || null
  } else if (clientDropField?.value) {
    clientName = typeof clientDropField.value === 'object'
      ? (clientDropField.value as { name?: string })?.name ?? null
      : String(clientDropField.value)
  }

  return {
    title: task.name,
    driveLink: driveField?.value ? String(driveField.value) : null,
    clientName,
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
