import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { processClickUpTask } from '@/lib/automation/process-task'
import { VIDEO_QUEUE_LIST_ID } from '@/lib/clickup/client'

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.CLICKUP_WEBHOOK_SECRET
  if (!secret) return true // allow through if secret not configured (backward compat)
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  return expected === signature
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-signature')

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    // ClickUp sends a verification challenge on webhook setup
    if (body.webhook_id && !body.task_id) {
      return NextResponse.json({ ok: true })
    }

    const { event, task_id, list_id } = body

    // Only process task creation in the Video Queue list
    if (event !== 'taskCreated') {
      return NextResponse.json({ ok: true, skipped: 'not a taskCreated event' })
    }

    if (list_id && list_id !== VIDEO_QUEUE_LIST_ID) {
      return NextResponse.json({ ok: true, skipped: 'not Video Queue list' })
    }

    if (!task_id) {
      return NextResponse.json({ error: 'No task_id in payload' }, { status: 400 })
    }

    // Process asynchronously — respond immediately so ClickUp doesn't retry
    processClickUpTask(task_id).catch((err) =>
      console.error('Background task processing failed:', err)
    )

    return NextResponse.json({ ok: true, processing: task_id })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// ClickUp sends a GET to verify the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true })
}
