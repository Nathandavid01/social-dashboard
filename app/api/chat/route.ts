import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Tool definitions ─────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: 'search_client',
    description: 'Search for a client by name and return their full profile including brand voice, hashtags, CTA, caption rules, and language. Use this whenever the user mentions a specific client.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Client name or partial name to search for' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_clients',
    description: 'List all clients with their basic info. Use when user asks for all clients or wants to filter by status/platform.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['active', 'paused', 'onboarding'], description: 'Filter by status (optional)' },
        with_metricool: { type: 'boolean', description: 'If true, only return clients with Metricool connected' },
      },
    },
  },
  {
    name: 'get_tasks',
    description: 'Get current open tasks from the operations board. Returns pending, in_progress, and blocked tasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'blocked', 'completed'], description: 'Filter by specific status (optional)' },
        client_name: { type: 'string', description: 'Filter tasks by client name (optional)' },
      },
    },
  },
  {
    name: 'generate_caption',
    description: 'Generate a social media caption for a specific client and video/post topic using their brand profile and Metricool style examples.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Client name to generate caption for' },
        topic: { type: 'string', description: 'Video title or post topic' },
        platform: { type: 'string', description: 'Target platform: instagram, tiktok, or facebook' },
      },
      required: ['client_name', 'topic'],
    },
  },
  {
    name: 'get_video_queue',
    description: 'Get approved videos from the dashboard Video QC that are ready to have captions generated.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_recent_posts',
    description: 'Get recently published Metricool posts. Use when asked about recent content, what was posted, or content for a specific client.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Filter posts by client name (optional)' },
        range: { type: 'string', enum: ['7d', '14d', '30d'], description: 'Time range to look back (default: 14d)' },
        platform: { type: 'string', description: 'Filter by platform: instagram, facebook, tiktok, etc. (optional)' },
      },
    },
  },
  {
    name: 'get_upcoming_schedule',
    description: 'Get posts scheduled for the next 7 days in Metricool. Use when asked what is coming up, scheduled, or planned for this week or next.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Filter by client name (optional)' },
        platform: { type: 'string', description: 'Filter by platform (optional)' },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task on the operations board. Use when the user asks to create, add, or log a task. If the user mentions a due date like "by Friday", "tomorrow", "next Monday", etc., compute the ISO date and include it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title/description' },
        client_name: { type: 'string', description: 'Client name to associate the task with (optional)' },
        type: { type: 'string', enum: ['content_creation', 'scheduling', 'reporting', 'client_call', 'review', 'other'], description: 'Task type (default: other)' },
        priority: { type: 'number', enum: [1, 2, 3], description: '1=high, 2=medium, 3=low (default: 2)' },
        due_at: { type: 'string', description: 'ISO 8601 due date/time (optional). Compute from natural language like "by Friday" or "tomorrow at 5pm".' },
        description: { type: 'string', description: 'Longer task description or notes (optional)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Update the status of a task by searching for it by title or partial title. Use when the user asks to mark a task as done, in progress, blocked, or pending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_title: { type: 'string', description: 'Task title or keywords to identify the task' },
        new_status: { type: 'string', enum: ['pending', 'in_progress', 'blocked', 'completed'], description: 'New status to set' },
        client_name: { type: 'string', description: 'Client name to narrow down the search (optional)' },
      },
      required: ['task_title', 'new_status'],
    },
  },
  {
    name: 'get_dashboard_summary',
    description: 'Get a comprehensive agency briefing: active tasks, overdue/blocked items, today\'s posts, team workload, and alerts. Use when asked for a status overview, "daily briefing", "how are things going?", or any general status check.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_active_alerts',
    description: 'Get current active alerts/notifications for the team. Use when asked about alerts, notifications, or what needs attention.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'create_alert',
    description: 'Create a team alert or notification. Use when the user asks to broadcast a message, create an announcement, flag an issue, or notify the team of something important.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Alert title (short, max ~60 chars)' },
        message: { type: 'string', description: 'Alert body/details (optional)' },
        severity: { type: 'string', enum: ['info', 'warning', 'error', 'success'], description: 'info=general, warning=caution, error=urgent, success=good news (default: info)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_client_efficiency',
    description: 'Get efficiency scores and health metrics for all clients. Shows which clients have overdue tasks, how many posts they have, and their overall health score.',
    input_schema: {
      type: 'object' as const,
      properties: {
        show_issues_only: { type: 'boolean', description: 'If true, only show clients with problems (score < 70 or overdue tasks)' },
      },
    },
  },
  {
    name: 'get_stale_clients',
    description: 'Find clients who have not had any published posts in Metricool in the last N days. Use when asked about inactive clients, clients who haven\'t posted recently, or posting cadence issues.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Number of days to check back (default: 7). Clients with no posts in this window are "stale".' },
      },
    },
  },
  {
    name: 'get_client_requests',
    description: 'Get pending client requests submitted through the client portal. Use when asked about client requests, incoming requests, or what clients have submitted.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['new', 'in_review', 'converted', 'rejected', 'open'], description: 'Filter by status. "open" means new + in_review (default: open)' },
      },
    },
  },
  {
    name: 'assign_task',
    description: 'Assign a task to a team member by searching the task by title and the person by name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_title: { type: 'string', description: 'Task title or keywords to find the task' },
        assignee_name: { type: 'string', description: 'Team member\'s name to assign to' },
      },
      required: ['task_title', 'assignee_name'],
    },
  },
  {
    name: 'get_team_workload',
    description: 'Get current task load per team member — who has what tasks, how many, overdue counts. Use when asked about team status, who is busy, or workload distribution.',
    input_schema: {
      type: 'object' as const,
      properties: {
        member_name: { type: 'string', description: 'Filter to a specific team member by name (optional)' },
      },
    },
  },
  {
    name: 'get_video_reviews',
    description: 'Get the status of video QC reviews — videos submitted by editors for review. Use when asked about video reviews, video QC, editing feedback, or which videos are pending/approved/need revision.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['submitted', 'head_editor_review', 'pending_final_check', 'final_check_review', 'revision_needed', 'approved', 'all'], description: 'Filter by review status (default: all open — any non-approved status)' },
        client_name: { type: 'string', description: 'Filter by client name (optional)' },
      },
    },
  },
  {
    name: 'search_posts',
    description: 'Search published Metricool posts by keyword across all clients. Use when the user asks to find a specific post, search captions, or look for content about a specific topic.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Keyword or phrase to search for in post captions' },
        client_name: { type: 'string', description: 'Limit search to a specific client (optional)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_todays_posts',
    description: 'Get all posts published or scheduled for today across all clients. Use when asked what was posted today, what is going out today, or today\'s content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Filter to a specific client (optional)' },
      },
    },
  },
  {
    name: 'get_member_tasks',
    description: 'Get all tasks assigned to a specific team member by name. Use when asked about a specific person\'s tasks, workload, or to-do list (e.g. "what does Anibeliz have?", "show Carlos tasks").',
    input_schema: {
      type: 'object' as const,
      properties: {
        member_name: { type: 'string', description: 'Team member full name or partial name' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'blocked', 'completed', 'all'], description: 'Filter by status (default: all open — pending + in_progress + blocked)' },
      },
      required: ['member_name'],
    },
  },
  {
    name: 'get_recording_sessions',
    description: 'Get scheduled recording sessions from the recording calendar. Use when asked about upcoming recordings, filming schedules, videographer assignments, or what sessions are planned.',
    input_schema: {
      type: 'object' as const,
      properties: {
        range: { type: 'string', enum: ['today', 'week', 'month'], description: 'Time range to look for sessions (default: week)' },
        videographer_name: { type: 'string', description: 'Filter by videographer name (optional)' },
        client_name: { type: 'string', description: 'Filter by client name (optional)' },
        status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled', 'all'], description: 'Filter by session status (default: scheduled)' },
      },
    },
  },
  {
    name: 'get_client_snapshot',
    description: 'Get a full snapshot of a specific client: their profile, last 5 posts, open tasks, and overall health. Use when asked "how is [client] doing?", "give me an update on [client]", or any per-client status check.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Client name to look up' },
      },
      required: ['client_name'],
    },
  },
  {
    name: 'get_weekly_report',
    description: 'Get a structured weekly content report: posts published per client per day for the past 7 days, plus platform breakdown and total counts. Use when asked "how did we do this week?", "weekly summary", "content report", "what did we post this week?", or any week-level content performance question.',
    input_schema: {
      type: 'object' as const,
      properties: {
        weeks_back: { type: 'number', description: 'How many weeks back to report on (default: 1 = this week, 2 = last week). Max 4.' },
      },
    },
  },
  {
    name: 'get_posts_by_date',
    description: 'Get all posts published or scheduled on a specific date or date range. Use when asked "what was posted on [date]", "show me posts from last Monday", "what went out on May 15", etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'ISO date string (YYYY-MM-DD). Compute from natural language: "yesterday", "last Monday", "May 15", etc.' },
        end_date: { type: 'string', description: 'End ISO date for a range (optional). Use for "last week" or "this week" queries.' },
        client_name: { type: 'string', description: 'Filter by client name (optional)' },
      },
      required: ['date'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete (permanently remove) a task from the operations board. Use when the user asks to delete, remove, or cancel a task. Always confirm which task you found before deleting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_title: { type: 'string', description: 'Task title or keywords to identify the task to delete' },
        client_name: { type: 'string', description: 'Client name to narrow down the search (optional)' },
      },
      required: ['task_title'],
    },
  },
  {
    name: 'update_task',
    description: 'Update a task\'s details: priority, due date, notes/description, or title. Use when the user asks to change a task\'s deadline, priority, or add notes to a task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_title: { type: 'string', description: 'Task title or keywords to find the task' },
        client_name: { type: 'string', description: 'Client name to narrow down (optional)' },
        new_priority: { type: 'number', enum: [1, 2, 3], description: 'New priority: 1=high, 2=medium, 3=low (optional)' },
        new_due_at: { type: 'string', description: 'New due date in ISO 8601 format (optional). Use null to clear it.' },
        new_title: { type: 'string', description: 'New task title (optional, only if renaming)' },
        new_description: { type: 'string', description: 'New description or notes (optional)' },
      },
      required: ['task_title'],
    },
  },
  {
    name: 'get_monthly_report',
    description: 'Get a structured monthly content report: total posts per client for the past month or a specific month, plus platform breakdown. Use when asked "how did we do this month?", "monthly summary", "how many posts did we do in April?", or any month-level content question.',
    input_schema: {
      type: 'object' as const,
      properties: {
        months_back: { type: 'number', description: 'How many months back: 0 = this month, 1 = last month, 2 = two months ago. Default: 0.' },
      },
    },
  },
  {
    name: 'dismiss_alert',
    description: 'Dismiss (delete) an active team alert by searching for it by title keyword. Use when the user asks to dismiss, remove, clear, or delete an alert.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title_keyword: { type: 'string', description: 'Keyword in the alert title to find it' },
      },
      required: ['title_keyword'],
    },
  },
  {
    name: 'create_recording_session',
    description: 'Schedule a new recording/filming session on the recording calendar. Use when asked to schedule a shoot, recording, or filming session for a client.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Session title (e.g. "Grabación mensual - Cliente X")' },
        client_name: { type: 'string', description: 'Client name to associate the session with (optional)' },
        session_date: { type: 'string', description: 'ISO date (YYYY-MM-DD). Compute from natural language: "next Tuesday", "this Friday", etc.' },
        start_time: { type: 'string', description: 'Start time in HH:MM format (optional, e.g. "09:00", "14:30")' },
        end_time: { type: 'string', description: 'End time in HH:MM format (optional)' },
        location: { type: 'string', description: 'Location or address (optional)' },
        videographer_name: { type: 'string', description: 'Videographer team member name (optional)' },
        notes: { type: 'string', description: 'Additional notes (optional)' },
      },
      required: ['title', 'session_date'],
    },
  },
  {
    name: 'get_production_tasks',
    description: 'Get production tasks (Reels and Posts) from the Producción module. Use when asked about production status, who is editing what, which pieces are in revision, or the weekly production board.',
    input_schema: {
      type: 'object' as const,
      properties: {
        week_start: { type: 'string', description: 'ISO date (YYYY-MM-DD) of the Monday to fetch. Defaults to current week.' },
        assignee_name: { type: 'string', description: 'Filter by team member name (optional)' },
        status: { type: 'string', enum: ['pendiente', 'en_edicion', 'en_revision', 'revisiones', 'aprobado', 'publicado', 'all'], description: 'Filter by production status (default: all active — excludes publicado)' },
        client_name: { type: 'string', description: 'Filter by client name (optional)' },
      },
    },
  },
  {
    name: 'update_production_status',
    description: 'Advance or change the status of a production task (Reel/Post). Use when asked to mark a production piece as edited, in revision, approved, or published.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Client name to find the task' },
        content_type: { type: 'string', enum: ['R', 'P'], description: 'R=Reel, P=Post' },
        publish_date: { type: 'string', description: 'ISO date of the publish date (YYYY-MM-DD), to identify the specific task' },
        new_status: { type: 'string', enum: ['pendiente', 'en_edicion', 'en_revision', 'revisiones', 'aprobado', 'publicado'], description: 'New production status' },
      },
      required: ['client_name', 'new_status'],
    },
  },
  {
    name: 'create_production_task',
    description: 'Create a special production request (one-off Reel or Post outside the regular schedule). Use when asked to add a new Reel/Post for a client that is not on the recurring schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Client name to create the task for' },
        content_type: { type: 'string', enum: ['R', 'P'], description: 'R=Reel, P=Post' },
        publish_date: { type: 'string', description: 'ISO date (YYYY-MM-DD) when the content should be published' },
        assignee_name: { type: 'string', description: 'Team member name to assign the task to (optional)' },
        priority: { type: 'string', enum: ['alta', 'media', 'baja'], description: 'Priority level (alta=high, media=medium, baja=low). Default: media' },
        notes: { type: 'string', description: 'Description or instructions for the task (optional)' },
      },
      required: ['client_name', 'content_type', 'publish_date'],
    },
  },
  {
    name: 'get_production_schedule',
    description: 'Get the recurring production schedule — which clients post on which days and with what content type. Use when asked about weekly schedules, recurring assignments, or how many posts a client is scheduled for per week.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_name: { type: 'string', description: 'Filter by client name (optional)' },
      },
    },
  },
  {
    name: 'get_content_analytics',
    description: 'Analyze content production metrics: posting cadence per client, platform breakdown, best posting days, trend direction (more or less than previous period), and which clients are above/below average output. Use when asked about content performance, posting frequency, which clients are posting most, analytics, or content trends.',
    input_schema: {
      type: 'object' as const,
      properties: {
        range: { type: 'string', enum: ['7d', '14d', '30d', '90d'], description: 'Time range to analyze (default: 30d)' },
        client_name: { type: 'string', description: 'Limit analysis to a specific client (optional)' },
      },
    },
  },
]

// ── Tool executors ───────────────────────────────────────────────────────────

async function execSearchClient(name: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', `%${name}%`)
    .limit(3)

  if (!data?.length) return `No client found matching "${name}".`

  return data.map((c) => {
    const lines = [
      `**${c.name}**`,
      `Industry: ${c.industry || 'Not set'}`,
      `Status: ${c.status}`,
      `Platforms: ${(c.platforms || []).join(', ')}`,
      `Language: ${c.caption_language || 'Not set'}`,
      `Brand Voice: ${c.brand_voice || 'Not set'}`,
      `CTA: ${c.default_cta || 'Not set'}`,
      `Hashtags: ${c.default_hashtags || 'Not set'}`,
      `Caption Rules: ${c.caption_notes || 'None'}`,
      `Metricool Blog ID: ${c.metricool_blog_id || 'Not connected'}`,
    ].join('\n')
    return lines
  }).join('\n\n---\n\n')
}

async function execListClients(status?: string, withMetricool?: boolean): Promise<string> {
  const supabase = await createClient()
  let query = supabase
    .from('clients')
    .select('name, industry, status, platforms, metricool_blog_id, brand_voice')
    .order('name')

  if (status) query = query.eq('status', status)
  if (withMetricool) query = query.not('metricool_blog_id', 'is', null)

  const { data } = await query
  if (!data?.length) return 'No clients found.'

  const list = data.map((c) => {
    const flags = [
      c.metricool_blog_id ? '⚡ Metricool' : '',
      c.brand_voice ? '🧠 AI' : '',
    ].filter(Boolean).join(' ')
    return `- **${c.name}** (${c.industry || 'No industry'}) — ${c.status} ${flags}`
  }).join('\n')

  return `${data.length} clients:\n\n${list}`
}

async function execGetTasks(status?: string, clientName?: string): Promise<string> {
  const supabase = await createClient()
  const statuses = status ? [status] : ['pending', 'in_progress', 'blocked']

  const query = supabase
    .from('tasks')
    .select('title, type, status, due_at, priority, client:clients(name)')
    .in('status', statuses)
    .order('priority', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(60)

  const { data } = await query
  if (!data?.length) return 'No tasks found.'

  let tasks = data
  if (clientName) {
    tasks = data.filter((t) => {
      const cn = (t.client as { name?: string } | null)?.name ?? ''
      return cn.toLowerCase().includes(clientName.toLowerCase())
    })
  }

  if (!tasks.length) return `No tasks found for "${clientName}".`

  const nowIso = new Date().toISOString()
  return tasks.map((t) => {
    const client = (t.client as { name?: string } | null)?.name
    const isOverdue = t.due_at && t.due_at < nowIso
    const due = t.due_at ? ` | Due: ${new Date(t.due_at).toLocaleDateString('es-PR')}${isOverdue ? ' ⏰OVERDUE' : ''}` : ''
    const priority = t.priority === 1 ? ' 🔴' : t.priority === 2 ? ' 🟡' : ''
    return `- [${t.status.toUpperCase()}] ${t.title}${client ? ` (${client})` : ''}${due}${priority}`
  }).join('\n')
}

async function execGenerateCaption(clientName: string, topic: string, platform?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', `%${clientName}%`)
      .limit(1)

    const client = clients?.[0]
    if (!client) return `Client "${clientName}" not found.`

    // Fetch Metricool style examples server-side
    let examples: { text: string; provider: string }[] = []
    try {
      const token = process.env.METRICOOL_TOKEN
      const userId = process.env.METRICOOL_USER_ID
      const blogId = client.metricool_blog_id || process.env.METRICOOL_BLOG_ID
      if (token && userId && blogId) {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=2025-01-01T00:00:00&end=2026-12-31T23:59:59`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (res.ok) {
          const json = await res.json() as { data?: { text: string; providers?: { network: string }[]; draft?: boolean }[] }
          examples = (json.data || [])
            .filter((p) => p.text?.trim().length > 20 && !p.draft)
            .map((p) => ({ text: p.text, provider: p.providers?.[0]?.network || 'instagram' }))
            .slice(0, 8)
        }
      }
    } catch { /* proceed without examples */ }

    const examplesBlock = examples.length > 0
      ? `REFERENCE CAPTIONS (match this style exactly):\n\n${examples.map((c, i) => `--- Example ${i + 1} (${c.provider}) ---\n${c.text}`).join('\n\n')}`
      : 'No previous captions. Write in a natural Puerto Rican social media style.'

    const profileLines = [
      client.brand_voice && `Brand voice: ${client.brand_voice}`,
      client.caption_language && `Language: ${client.caption_language} (write in this language)`,
      client.default_cta && `CTA: ${client.default_cta}`,
      client.default_hashtags && `Hashtags: ${client.default_hashtags}`,
      client.caption_notes && `Rules: ${client.caption_notes}`,
    ].filter(Boolean).join('\n')

    const captionMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `You are a professional social media copywriter for NMedia PR.\n\nCLIENT: ${client.name}\nINDUSTRY: ${client.industry || 'Business'}\nPLATFORM: ${platform || 'Instagram'}\n\n${profileLines ? `CLIENT PROFILE:\n${profileLines}\n\n` : ''}${examplesBlock}\n\nVIDEO TOPIC: "${topic}"\n\nWrite ONE complete social media caption. Output ONLY the caption text — no labels, no explanation.`,
      }],
    })

    const caption = captionMsg.content[0].type === 'text' ? captionMsg.content[0].text.trim() : ''
    return `Here's the caption for **${client.name}**${examples.length > 0 ? ` (based on ${examples.length} real posts)` : ''}:\n\n\`\`\`\n${caption}\n\`\`\``
  } catch (err) {
    return `Error generating caption: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execGetVideoQueue(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('video_reviews')
      .select('id, title, drive_link, client:clients!video_reviews_client_id_fkey(name)')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(20)

    if (error) return 'Error fetching approved videos.'
    if (!data?.length) return 'No hay videos aprobados pendientes de caption en este momento.'

    return data.map((v) => {
      const client = v.client as unknown as { name: string } | null
      return `- **${v.title}** | Cliente: ${client?.name || 'sin asignar'} | Drive: ${v.drive_link ? '✓' : 'sin link'}`
    }).join('\n')
  } catch {
    return 'Error fetching approved video queue.'
  }
}

async function execGetRecentPosts(clientName?: string, range?: string, platform?: string): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool not configured.'

    const supabase = await createClient()
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 14
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    const startStr = start.toISOString().slice(0, 19)
    const endStr = end.toISOString().slice(0, 19)

    // Get clients to fetch from
    let query = supabase.from('clients').select('id, name, metricool_blog_id').not('metricool_blog_id', 'is', null).eq('status', 'active')
    if (clientName) query = query.ilike('name', `%${clientName}%`)

    const { data: clients } = await query.limit(clientName ? 3 : 50)
    if (!clients?.length) return clientName ? `No client found matching "${clientName}".` : 'No Metricool clients configured.'

    const results = await Promise.allSettled(
      clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${startStr}&end=${endStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return []
        const json = await res.json() as { data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
        return (json.data || [])
          .filter((p) => !p.draft && p.text?.trim())
          .map((p) => ({
            client: c.name,
            text: p.text,
            date: p.publicationDate?.dateTime || '',
            platforms: (p.providers || []).map((x) => x.network),
          }))
      })
    )

    const posts = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<{ client: string; text: string; date: string; platforms: string[] }[]>).value)
      .filter((p) => !platform || p.platforms.includes(platform))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 15)

    if (!posts.length) return 'No posts found for that filter.'

    return posts.map((p) => {
      const dateStr = p.date ? new Date(p.date).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' }) : ''
      const excerpt = p.text.length > 120 ? p.text.slice(0, 120) + '…' : p.text
      return `**${p.client}** (${p.platforms.join(', ')}) — ${dateStr}\n${excerpt}`
    }).join('\n\n---\n\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execGetUpcomingSchedule(clientName?: string, platform?: string): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool not configured.'

    const supabase = await createClient()
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const startStr = now.toISOString().slice(0, 19)
    const endStr = nextWeek.toISOString().slice(0, 19)

    let query = supabase.from('clients').select('id, name, metricool_blog_id').not('metricool_blog_id', 'is', null).eq('status', 'active')
    if (clientName) query = query.ilike('name', `%${clientName}%`)

    const { data: clients } = await query.limit(clientName ? 3 : 50)
    if (!clients?.length) return clientName ? `No client found matching "${clientName}".` : 'No Metricool clients configured.'

    const results = await Promise.allSettled(
      clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${startStr}&end=${endStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return []
        const json = await res.json() as { data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
        return (json.data || [])
          .filter((p) => p.text?.trim())
          .map((p) => ({
            client: c.name,
            text: p.text,
            date: p.publicationDate?.dateTime || '',
            platforms: (p.providers || []).map((x) => x.network),
            isDraft: p.draft,
          }))
      })
    )

    const posts = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<{ client: string; text: string; date: string; platforms: string[]; isDraft: boolean }[]>).value)
      .filter((p) => !platform || p.platforms.includes(platform))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20)

    if (!posts.length) return 'No posts scheduled for the next 7 days.'

    return `**Upcoming schedule — next 7 days** (${posts.length} posts):\n\n` + posts.map((p) => {
      const dateStr = p.date ? new Date(p.date).toLocaleString('es-PR', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''
      const excerpt = p.text.length > 80 ? p.text.slice(0, 80) + '…' : p.text
      const draftLabel = p.isDraft ? ' *(draft)*' : ''
      return `• **${p.client}** — ${dateStr} (${p.platforms.join(', ')})${draftLabel}\n  ${excerpt}`
    }).join('\n\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execCreateTask(title: string, clientName?: string, type?: string, priority?: number, dueAt?: string, description?: string): Promise<string> {
  try {
    const supabase = await createClient()

    let clientId: string | null = null
    if (clientName) {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', `%${clientName}%`)
        .limit(1)
        .single()
      clientId = data?.id ?? null
      if (!clientId) return `Could not find client "${clientName}". Task not created.`
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('tasks').insert({
      title,
      description: description ?? null,
      client_id: clientId,
      type: type || 'other',
      priority: priority || 2,
      status: 'pending',
      due_at: dueAt ?? null,
      created_by: user?.id ?? '',
    })

    if (error) return `Error creating task: ${error.message}`

    const clientStr = clientId && clientName ? ` for **${clientName}**` : ''
    const dueStr = dueAt ? ` | Due: ${new Date(dueAt).toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''
    return `✅ Task created${clientStr}: "${title}"${dueStr}\n\nVisible in the Operations board.`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execUpdateTaskStatus(taskTitle: string, newStatus: string, clientName?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const query = supabase
      .from('tasks')
      .select('id, title, status, client:clients(name)')
      .ilike('title', `%${taskTitle}%`)
      .neq('status', 'completed')
      .limit(5)

    const { data } = await query
    if (!data?.length) return `No open task found matching "${taskTitle}".`

    let candidates = data
    if (clientName) {
      candidates = data.filter((t) => {
        const cn = (t.client as { name?: string } | null)?.name ?? ''
        return cn.toLowerCase().includes(clientName.toLowerCase())
      })
      if (!candidates.length) candidates = data
    }

    const task = candidates[0]
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', task.id)

    if (error) return `Error updating task: ${error.message}`

    const clientStr = (task.client as { name?: string } | null)?.name ? ` (${(task.client as { name?: string }).name})` : ''
    return `✅ Task "${task.title}"${clientStr} moved to **${newStatus}**.${candidates.length > 1 ? `\n\n_${candidates.length - 1} other match(es) found — updated the first one. Be more specific if needed._` : ''}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execGetDashboardSummary(): Promise<string> {
  try {
    const supabase = await createClient()
    const nowIso = new Date().toISOString()
    const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00'
    const todayEnd = new Date().toISOString().slice(0, 10) + 'T23:59:59'

    const [
      { data: tasks },
      { data: alerts },
      { count: clientCount },
      { count: pendingRequests },
      { count: pendingVideos },
      { data: profiles },
      { data: prodTasks },
    ] = await Promise.all([
      supabase.from('tasks').select('id, title, status, due_at, priority, assignee:profiles!tasks_assignee_id_fkey(full_name), client:clients(name)').neq('status', 'completed'),
      supabase.from('alerts').select('title, severity, message').order('created_at', { ascending: false }).limit(5),
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('client_requests').select('*', { count: 'exact', head: true }).in('status', ['new', 'in_review']),
      supabase.from('video_reviews').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'head_editor_review', 'pending_final_check', 'final_check_review', 'revision_needed']),
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('production_tasks').select('status, content_type, publish_date, client:clients!production_tasks_client_id_fkey(name)').neq('status', 'publicado').order('publish_date').limit(200),
    ])

    const all = tasks ?? []
    const pending = all.filter((t) => t.status === 'pending').length
    const inProgress = all.filter((t) => t.status === 'in_progress').length
    const blocked = all.filter((t) => t.status === 'blocked').length
    const overdueTasks = all.filter((t) => t.due_at && t.due_at < nowIso)
    const dueTodayTasks = all.filter((t) => t.due_at && t.due_at >= todayStart && t.due_at <= todayEnd)
    const highPriorityTasks = all.filter((t) => t.priority === 1)
    const criticalAlerts = (alerts ?? []).filter((a) => a.severity === 'error')
    const warningAlerts = (alerts ?? []).filter((a) => a.severity === 'warning')

    // Team workload
    const tasksByMember: Record<string, { name: string; count: number; overdue: number }> = {}
    for (const t of all) {
      const assignee = t.assignee as { full_name?: string } | null
      if (!assignee?.full_name) continue
      if (!tasksByMember[assignee.full_name]) tasksByMember[assignee.full_name] = { name: assignee.full_name, count: 0, overdue: 0 }
      tasksByMember[assignee.full_name].count++
      if (t.due_at && t.due_at < nowIso) tasksByMember[assignee.full_name].overdue++
    }
    const teamLines = Object.values(tasksByMember)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((m) => `  • ${m.name}: ${m.count} open${m.overdue > 0 ? ` (${m.overdue} OVERDUE ⚠️)` : ''}`)

    const lines: string[] = [
      `**📊 Agency Daily Briefing**`,
      ``,
    ]

    // Urgent items first
    if (criticalAlerts.length > 0) {
      lines.push(`🔴 **ALERTS (${criticalAlerts.length}):**`)
      criticalAlerts.forEach((a) => lines.push(`  • ${a.title}${a.message ? `: ${a.message.slice(0, 80)}` : ''}`))
      lines.push(``)
    }

    if (overdueTasks.length > 0) {
      lines.push(`⏰ **Overdue Tasks (${overdueTasks.length}):**`)
      overdueTasks.slice(0, 5).forEach((t) => {
        const client = (t.client as { name?: string } | null)?.name
        const assignee = (t.assignee as { full_name?: string } | null)?.full_name
        lines.push(`  • ${t.title}${client ? ` @ ${client}` : ''}${assignee ? ` — ${assignee}` : ''}`)
      })
      if (overdueTasks.length > 5) lines.push(`  … +${overdueTasks.length - 5} more`)
      lines.push(``)
    }

    // Task board status
    lines.push(`**📋 Tasks:** ${all.length} open total`)
    lines.push(`• ${inProgress} in progress · ${pending} pending · ${blocked} blocked`)
    if (highPriorityTasks.length > 0) lines.push(`• 🚨 ${highPriorityTasks.length} high-priority`)
    if (dueTodayTasks.length > 0) lines.push(`• ⏰ ${dueTodayTasks.length} due today`)
    lines.push(``)

    // Production module stats
    const prod = prodTasks ?? []
    if (prod.length > 0) {
      const prodPendiente = prod.filter((t) => t.status === 'pendiente').length
      const prodEdicion = prod.filter((t) => t.status === 'en_edicion').length
      const prodRevision = prod.filter((t) => t.status === 'en_revision').length
      const prodCambios = prod.filter((t) => t.status === 'revisiones').length
      const prodAprobado = prod.filter((t) => t.status === 'aprobado').length
      const prodReels = prod.filter((t) => t.content_type === 'R').length
      const prodPosts = prod.filter((t) => t.content_type === 'P').length
      const today = new Date().toISOString().slice(0, 10)
      const publishingToday = prod.filter((t) => t.publish_date === today)
      lines.push(`**🎬 Producción:** ${prod.length} activas (${prodReels} Reels · ${prodPosts} Posts)`)
      lines.push(`• ${prodEdicion} en edición · ${prodRevision} en revisión · ${prodCambios} necesitan cambios · ${prodAprobado} aprobados`)
      if (prodPendiente > 0) lines.push(`• ${prodPendiente} pendientes de asignar`)
      if (publishingToday.length > 0) {
        const clientNames = Array.from(new Set(publishingToday.map((t) => (t.client as { name?: string } | null)?.name).filter(Boolean))).slice(0, 3).join(', ')
        lines.push(`• 📅 ${publishingToday.length} publicando hoy${clientNames ? ` (${clientNames})` : ''}`)
      }
      if (prodRevision + prodCambios > 0) lines.push(`• ⚠️ ${prodRevision + prodCambios} piezas necesitan atención en Para Revisar`)
      lines.push(``)
    }

    // Team
    if (teamLines.length > 0) {
      lines.push(`**👥 Team Workload:**`)
      lines.push(...teamLines)
      lines.push(``)
    }

    // Alerts
    if (warningAlerts.length > 0) {
      lines.push(`🟡 **Warnings (${warningAlerts.length}):** ${warningAlerts.map((a) => a.title).join(', ')}`)
      lines.push(``)
    }

    // Other items
    lines.push(`**Active Clients:** ${clientCount ?? 0}`)
    if ((pendingRequests ?? 0) > 0) lines.push(`**Inbox:** ${pendingRequests} pending client request${pendingRequests !== 1 ? 's' : ''}`)
    if ((pendingVideos ?? 0) > 0) lines.push(`**Video QC:** ${pendingVideos} awaiting review`)
    if (!criticalAlerts.length && !warningAlerts.length) lines.push(`**Alerts:** All clear ✓`)

    return lines.join('\n')
  } catch (err) {
    return `Error fetching summary: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execGetActiveAlerts(): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('alerts')
      .select('title, message, severity, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!data?.length) return 'No active alerts at this time.'

    const lines = data.map((a) => {
      const icon = a.severity === 'error' ? '🔴' : a.severity === 'warning' ? '🟡' : a.severity === 'success' ? '🟢' : 'ℹ️'
      const exp = a.expires_at ? ` (expires ${new Date(a.expires_at).toLocaleDateString('es-PR')})` : ''
      return `${icon} **${a.title}**${a.message ? `\n   ${a.message}` : ''}${exp}`
    }).join('\n\n')

    return `**Active Alerts (${data.length}):**\n\n${lines}`
  } catch (err) {
    return `Error fetching alerts: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execCreateAlert(title: string, message?: string, severity?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Not authenticated.'

    const { error } = await supabase.from('alerts').insert({
      title,
      message: message || null,
      severity: severity || 'info',
      created_by: user.id,
    })

    if (error) return `Error creating alert: ${error.message}`

    const icon = severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : severity === 'success' ? '🟢' : 'ℹ️'
    return `${icon} Alert created: **"${title}"**\n\nThe team will see it in the Alerts Center.`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetClientEfficiency(showIssuesOnly?: boolean): Promise<string> {
  try {
    const supabase = await createClient()
    const nowIso = new Date().toISOString()
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, status, metricool_blog_id')
      .eq('status', 'active')
      .order('name')
      .limit(60)

    if (!clients?.length) return 'No active clients found.'

    const { data: tasks } = await supabase
      .from('tasks')
      .select('client_id, status, due_at')
      .neq('status', 'completed')
      .not('client_id', 'is', null)

    const clientTasks: Record<string, { total: number; overdue: number; blocked: number }> = {}
    for (const t of tasks ?? []) {
      if (!t.client_id) continue
      if (!clientTasks[t.client_id]) clientTasks[t.client_id] = { total: 0, overdue: 0, blocked: 0 }
      clientTasks[t.client_id].total++
      if (t.due_at && t.due_at < nowIso) clientTasks[t.client_id].overdue++
      if (t.status === 'blocked') clientTasks[t.client_id].blocked++
    }

    let rows = clients.map((c) => {
      const ct = clientTasks[c.id] || { total: 0, overdue: 0, blocked: 0 }
      const hasMetricool = !!c.metricool_blog_id
      let score = 100
      score -= ct.overdue * 15
      score -= ct.blocked * 10
      if (!hasMetricool) score -= 10
      score = Math.max(0, Math.min(100, score))
      return { name: c.name, score, ...ct, hasMetricool }
    }).sort((a, b) => a.score - b.score)

    if (showIssuesOnly) {
      rows = rows.filter((r) => r.score < 70 || r.overdue > 0)
    }

    if (!rows.length) return 'All clients look healthy!'

    const lines = rows.slice(0, 20).map((r) => {
      const icon = r.score >= 80 ? '🟢' : r.score >= 60 ? '🟡' : '🔴'
      const issues = [
        r.overdue > 0 ? `${r.overdue} overdue` : '',
        r.blocked > 0 ? `${r.blocked} blocked` : '',
        !r.hasMetricool ? 'no Metricool' : '',
      ].filter(Boolean).join(', ')
      return `${icon} **${r.name}** — score ${r.score}${issues ? ` | ⚠ ${issues}` : ''}`
    })

    return `**Client Efficiency${showIssuesOnly ? ' — Issues' : ''}:**\n\n${lines.join('\n')}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetStaleClients(days: number = 7): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool not configured.'

    const supabase = await createClient()
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, metricool_blog_id')
      .not('metricool_blog_id', 'is', null)
      .eq('status', 'active')
      .order('name')

    if (!clients?.length) return 'No Metricool clients configured.'

    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    const startStr = start.toISOString().slice(0, 19)
    const endStr = end.toISOString().slice(0, 19)

    const results = await Promise.allSettled(
      clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${startStr}&end=${endStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return { name: c.name, postCount: 0, error: true }
        const json = await res.json() as { data?: { draft?: boolean }[] }
        const published = (json.data || []).filter((p) => !p.draft).length
        return { name: c.name, postCount: published, error: false }
      })
    )

    const clientData = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<{ name: string; postCount: number; error: boolean }>).value)
      .sort((a, b) => a.postCount - b.postCount)

    const stale = clientData.filter((c) => c.postCount === 0 && !c.error)
    const active = clientData.filter((c) => c.postCount > 0)

    if (!stale.length) return `✅ All ${clients.length} Metricool clients have published in the last ${days} days.`

    // For stale clients, find their last post date (look back 180 days)
    const staleLookback = new Date()
    staleLookback.setDate(staleLookback.getDate() - 180)
    const staleLookbackStr = staleLookback.toISOString().slice(0, 19)

    const staleWithLastPost = await Promise.allSettled(
      stale.map(async (c) => {
        const cl = clients.find((x) => x.name === c.name)
        if (!cl) return { ...c, lastPostDaysAgo: null }
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${cl.metricool_blog_id}&start=${staleLookbackStr}&end=${startStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return { ...c, lastPostDaysAgo: null }
        const json = await res.json() as { data?: { publicationDate: { dateTime: string }; draft?: boolean }[] }
        const posts = (json.data || []).filter((p) => !p.draft && p.publicationDate?.dateTime)
        if (!posts.length) return { ...c, lastPostDaysAgo: null }
        const latestDate = posts.map((p) => p.publicationDate.dateTime).sort().reverse()[0]
        const daysAgo = Math.floor((Date.now() - new Date(latestDate).getTime()) / 86400000)
        return { ...c, lastPostDaysAgo: daysAgo }
      })
    )

    const enrichedStale = staleWithLastPost
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<{ name: string; postCount: number; error: boolean; lastPostDaysAgo: number | null }>).value)
      .sort((a, b) => (b.lastPostDaysAgo ?? 9999) - (a.lastPostDaysAgo ?? 9999))

    const staleList = enrichedStale.map((c) => {
      const lastStr = c.lastPostDaysAgo !== null ? ` (last post: ${c.lastPostDaysAgo}d ago)` : ' (no recent history)'
      return `• **${c.name}**${lastStr}`
    }).join('\n')
    const activeTop = active.slice(0, 5).map((c) => `• ${c.name} — ${c.postCount} posts`).join('\n')

    return [
      `**⚠️ Clients with no posts in the last ${days} days (${enrichedStale.length}/${clients.length}):**`,
      '',
      staleList,
      '',
      active.length > 0 ? `**Most active this period:**\n${activeTop}` : '',
    ].filter(Boolean).join('\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetClientRequests(status?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const statuses = status === 'open' || !status ? ['new', 'in_review'] : [status]
    const { data } = await supabase
      .from('client_requests')
      .select('company_name, contact_name, request_type, urgency, status, description, created_at')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!data?.length) return `No ${status === 'open' || !status ? 'pending' : status} client requests.`

    const urgencyIcon: Record<string, string> = { urgent: '🔴', high: '🟠', normal: '🟡', low: '🟢' }
    return `**Client Requests (${data.length}):**\n\n` + data.map((r) => {
      const icon = urgencyIcon[r.urgency] ?? '⚪'
      const date = new Date(r.created_at).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })
      const excerpt = r.description.length > 100 ? r.description.slice(0, 100) + '…' : r.description
      return `${icon} **${r.company_name}** — ${r.request_type} | ${r.status}\n  Contact: ${r.contact_name} (${date})\n  "${excerpt}"`
    }).join('\n\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execAssignTask(taskTitle: string, assigneeName: string): Promise<string> {
  try {
    const supabase = await createClient()

    const [{ data: tasks }, { data: profiles }] = await Promise.all([
      supabase.from('tasks').select('id, title, assignee_id').ilike('title', `%${taskTitle}%`).neq('status', 'completed').limit(5),
      supabase.from('profiles').select('id, full_name').ilike('full_name', `%${assigneeName}%`).limit(3),
    ])

    if (!tasks?.length) return `No open task found matching "${taskTitle}".`
    if (!profiles?.length) return `No team member found matching "${assigneeName}".`

    const task = tasks[0]
    const profile = profiles[0]

    const { error } = await supabase.from('tasks').update({ assignee_id: profile.id }).eq('id', task.id)
    if (error) return `Error assigning task: ${error.message}`

    return `✅ Task **"${task.title}"** assigned to **${profile.full_name}**.`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetTeamWorkload(memberName?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const nowIso = new Date().toISOString()

    const [{ data: profiles }, { data: tasks }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase
        .from('tasks')
        .select('assignee_id, title, status, due_at, priority, client:clients(name)')
        .neq('status', 'completed')
        .not('assignee_id', 'is', null),
    ])

    if (!profiles?.length) return 'No team members found.'

    const tasksByMember: Record<string, typeof tasks> = {}
    for (const t of tasks ?? []) {
      if (!t.assignee_id) continue
      if (!tasksByMember[t.assignee_id]) tasksByMember[t.assignee_id] = []
      tasksByMember[t.assignee_id]!.push(t)
    }

    let members = profiles.map((p) => {
      const mt = tasksByMember[p.id] ?? []
      const overdue = mt.filter((t) => t.due_at && t.due_at < nowIso).length
      const inProgress = mt.filter((t) => t.status === 'in_progress').length
      return { ...p, total: mt.length, overdue, inProgress, tasks: mt }
    })

    if (memberName) {
      members = members.filter((m) => m.full_name?.toLowerCase().includes(memberName.toLowerCase()))
    }

    if (!members.length) return `No team member found matching "${memberName}".`

    return members.map((m) => {
      const icon = m.overdue > 0 ? '🔴' : m.total === 0 ? '🟢' : '🔵'
      const taskList = m.tasks.slice(0, 5).map((t) => {
        const client = (t.client as { name?: string } | null)?.name
        const isOverdue = t.due_at && t.due_at < nowIso
        return `  • ${t.title}${client ? ` (${client})` : ''}${isOverdue ? ' ⏰' : ''}`
      }).join('\n')
      return [
        `${icon} **${m.full_name}** — ${m.total} open tasks (${m.inProgress} in progress${m.overdue > 0 ? `, ${m.overdue} overdue` : ''})`,
        taskList,
        m.tasks.length > 5 ? `  … +${m.tasks.length - 5} more` : '',
      ].filter(Boolean).join('\n')
    }).join('\n\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execSearchPosts(query: string, clientName?: string): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool not configured.'

    const supabase = await createClient()
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 90)
    const startStr = start.toISOString().slice(0, 19)
    const endStr = end.toISOString().slice(0, 19)

    let dbQuery = supabase.from('clients').select('id, name, metricool_blog_id').not('metricool_blog_id', 'is', null).eq('status', 'active')
    if (clientName) dbQuery = dbQuery.ilike('name', `%${clientName}%`)
    const { data: clients } = await dbQuery.limit(clientName ? 3 : 50)
    if (!clients?.length) return clientName ? `No client found matching "${clientName}".` : 'No Metricool clients configured.'

    const results = await Promise.allSettled(
      clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${startStr}&end=${endStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return []
        const json = await res.json() as { data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
        return (json.data || [])
          .filter((p) => !p.draft && p.text?.toLowerCase().includes(query.toLowerCase()))
          .map((p) => ({
            client: c.name,
            text: p.text,
            date: p.publicationDate?.dateTime || '',
            platforms: (p.providers || []).map((x) => x.network),
          }))
      })
    )

    const posts = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<{ client: string; text: string; date: string; platforms: string[] }[]>).value)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)

    if (!posts.length) return `No posts found containing "${query}" in the last 90 days.`

    return `**Posts matching "${query}" (${posts.length}):**\n\n` + posts.map((p) => {
      const dateStr = p.date ? new Date(p.date).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
      const excerpt = p.text.length > 150 ? p.text.slice(0, 150) + '…' : p.text
      return `**${p.client}** — ${p.platforms.join(', ')} | ${dateStr}\n${excerpt}`
    }).join('\n\n---\n\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execGetTodaysPosts(clientName?: string): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool not configured.'

    const supabase = await createClient()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19)
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString().slice(0, 19)

    let dbQuery = supabase.from('clients').select('id, name, metricool_blog_id').not('metricool_blog_id', 'is', null).eq('status', 'active')
    if (clientName) dbQuery = dbQuery.ilike('name', `%${clientName}%`)
    const { data: clients } = await dbQuery.limit(clientName ? 3 : 50)
    if (!clients?.length) return 'No Metricool clients configured.'

    const results = await Promise.allSettled(
      clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${todayStart}&end=${todayEnd}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return []
        const json = await res.json() as { data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
        return (json.data || [])
          .filter((p) => p.text?.trim())
          .map((p) => ({
            client: c.name,
            text: p.text || '',
            date: p.publicationDate?.dateTime || '',
            platforms: (p.providers || []).map((x) => x.network),
            isDraft: p.draft ?? false,
          }))
      })
    )

    const posts = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<{ client: string; text: string; date: string; platforms: string[]; isDraft: boolean }[]>).value)
      .sort((a, b) => a.date.localeCompare(b.date))

    if (!posts.length) return `No posts scheduled or published today${clientName ? ` for ${clientName}` : ''}.`

    const published = posts.filter((p) => new Date(p.date) <= now && !p.isDraft)
    const scheduled = posts.filter((p) => new Date(p.date) > now || p.isDraft)

    const formatTime = (d: string) => new Date(d).toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true })

    let out = `**Today's posts (${posts.length} total):**\n`
    if (published.length) {
      out += `\n✅ **Published (${published.length}):**\n` + published.map((p) =>
        `• **${p.client}** @ ${formatTime(p.date)} (${p.platforms.join(', ')})\n  ${p.text.slice(0, 80)}${p.text.length > 80 ? '…' : ''}`
      ).join('\n')
    }
    if (scheduled.length) {
      out += `\n\n📅 **Scheduled (${scheduled.length}):**\n` + scheduled.map((p) =>
        `• **${p.client}** @ ${formatTime(p.date)} (${p.platforms.join(', ')})\n  ${p.text.slice(0, 80)}${p.text.length > 80 ? '…' : ''}`
      ).join('\n')
    }
    return out
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execGetVideoReviews(status?: string, clientName?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const openStatuses = ['submitted', 'head_editor_review', 'pending_final_check', 'final_check_review', 'revision_needed']

    let query = supabase
      .from('video_reviews')
      .select('title, status, errors, revision_count, created_at, client:clients(name), editor:profiles!video_reviews_editor_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(25)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    } else if (!status) {
      query = query.in('status', openStatuses)
    }

    const { data } = await query
    if (!data?.length) return 'No video reviews found.'

    let reviews = data
    if (clientName) {
      reviews = data.filter((r) => {
        const cn = (r.client as { name?: string } | null)?.name ?? ''
        return cn.toLowerCase().includes(clientName.toLowerCase())
      })
    }

    if (!reviews.length) return `No video reviews found for "${clientName}".`

    const statusIcon: Record<string, string> = {
      submitted: '⏳', in_review: '🔍', revision_needed: '🔴', approved: '✅',
    }

    return `**Video QC Reviews (${reviews.length}):**\n\n` + reviews.map((r) => {
      const icon = statusIcon[r.status] ?? '⚪'
      const clientStr = (r.client as { name?: string } | null)?.name ?? 'No client'
      const editorStr = (r.editor as { full_name?: string } | null)?.full_name ?? 'Unknown'
      const revStr = r.revision_count > 0 ? ` | ${r.revision_count} revision(s)` : ''
      const errStr = r.errors?.length > 0 ? ` | Errors: ${r.errors.join(', ')}` : ''
      return `${icon} **${r.title}** (${clientStr})\n  Editor: ${editorStr} · Status: ${r.status}${revStr}${errStr}`
    }).join('\n\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetMemberTasks(memberName: string, status?: string): Promise<string> {
  try {
    const supabase = await createClient()

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .ilike('full_name', `%${memberName}%`)
      .limit(3)

    if (!profiles?.length) return `No team member found matching "${memberName}".`

    const member = profiles[0]
    const openStatuses = ['pending', 'in_progress', 'blocked']

    let query = supabase
      .from('tasks')
      .select('title, status, priority, due_at, client:clients!tasks_client_id_fkey(name)')
      .eq('assignee_id', member.id)
      .order('priority', { ascending: true })
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(30)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    } else {
      query = query.in('status', openStatuses)
    }

    const { data: tasks } = await query
    const name = member.full_name || member.email || memberName

    if (!tasks?.length) return `${name} has no ${status && status !== 'all' ? status : 'open'} tasks.`

    const priorityLabel = (p: number) => p === 1 ? '🔴 High' : p === 2 ? '🟡 Med' : '🟢 Low'
    const statusLabel: Record<string, string> = { pending: '⬜', in_progress: '🔵', blocked: '🔴', completed: '✅' }
    const now = new Date().toISOString()

    const lines = tasks.map((t) => {
      const clientName = (t.client as { name?: string } | null)?.name
      const overdue = t.due_at && t.due_at < now && t.status !== 'completed' ? ' ⚠️ OVERDUE' : ''
      const due = t.due_at ? ` · Due ${new Date(t.due_at).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}` : ''
      const client = clientName ? ` @ ${clientName}` : ''
      return `${statusLabel[t.status] ?? '⬜'} ${priorityLabel(t.priority)} **${t.title}**${client}${due}${overdue}`
    })

    const grouped = { blocked: tasks.filter((t) => t.status === 'blocked').length, in_progress: tasks.filter((t) => t.status === 'in_progress').length, pending: tasks.filter((t) => t.status === 'pending').length }

    return `**${name}'s tasks (${tasks.length} open):**\n${grouped.blocked > 0 ? `🔴 ${grouped.blocked} blocked · ` : ''}${grouped.in_progress > 0 ? `🔵 ${grouped.in_progress} in progress · ` : ''}${grouped.pending > 0 ? `⬜ ${grouped.pending} pending` : ''}\n\n${lines.join('\n')}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetRecordingSessions(range?: string, videographerName?: string, clientName?: string, status?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const now = new Date()
    let start: string, end: string

    if (range === 'today') {
      start = now.toISOString().slice(0, 10)
      end = start
    } else if (range === 'month') {
      start = now.toISOString().slice(0, 10)
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      end = nextMonth.toISOString().slice(0, 10)
    } else {
      // Default: this week (next 7 days)
      start = now.toISOString().slice(0, 10)
      const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      end = weekEnd.toISOString().slice(0, 10)
    }

    let query = supabase
      .from('recording_sessions')
      .select(`
        title, session_date, start_time, end_time, location, notes, status,
        client:clients!recording_sessions_client_id_fkey(name),
        videographer:profiles!recording_sessions_videographer_id_fkey(full_name)
      `)
      .gte('session_date', start)
      .lte('session_date', end)
      .order('session_date')
      .order('start_time', { nullsFirst: true })
      .limit(30)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    } else if (!status) {
      query = query.eq('status', 'scheduled')
    }

    const { data: sessions, error } = await query
    if (error) return `Error fetching recording sessions: ${error.message}`

    let filtered = sessions ?? []

    if (videographerName) {
      filtered = filtered.filter((s) => {
        const vName = (s.videographer as { full_name?: string } | null)?.full_name ?? ''
        return vName.toLowerCase().includes(videographerName.toLowerCase())
      })
    }
    if (clientName) {
      filtered = filtered.filter((s) => {
        const cName = (s.client as { name?: string } | null)?.name ?? ''
        return cName.toLowerCase().includes(clientName.toLowerCase())
      })
    }

    if (!filtered.length) {
      return `No recording sessions found${range ? ` for the ${range === 'week' ? 'next 7 days' : range}` : ''}.`
    }

    const lines = filtered.map((s) => {
      const clientStr = (s.client as { name?: string } | null)?.name ?? 'No client'
      const vStr = (s.videographer as { full_name?: string } | null)?.full_name ?? 'Unassigned'
      const time = s.start_time ? ` @ ${s.start_time.slice(0, 5)}${s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}` : ''
      const loc = s.location ? ` · 📍 ${s.location}` : ''
      const note = s.notes ? ` · ${s.notes.slice(0, 60)}${s.notes.length > 60 ? '…' : ''}` : ''
      return `📅 **${s.session_date}${time}** — ${s.title}\n  Client: ${clientStr} · Videographer: ${vStr}${loc}${note}`
    })

    return `**Recording Sessions (${filtered.length}):**\n\n${lines.join('\n\n')}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetClientSnapshot(clientName: string): Promise<string> {
  try {
    const supabase = await createClient()

    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', `%${clientName}%`)
      .limit(1)

    const client = clients?.[0]
    if (!client) return `No client found matching "${clientName}".`

    const nowIso = new Date().toISOString()

    const [{ data: openTasks }, { data: completedTasks }] = await Promise.all([
      supabase.from('tasks').select('title, status, priority, due_at, assignee:profiles!tasks_assignee_id_fkey(full_name)').eq('client_id', client.id).neq('status', 'completed').order('priority', { ascending: true }).limit(10),
      supabase.from('tasks').select('title, updated_at').eq('client_id', client.id).eq('status', 'completed').order('updated_at', { ascending: false }).limit(3),
    ])

    // Fetch recent posts from Metricool
    let recentPosts: { text: string; date: string; platforms: string[] }[] = []
    if (client.metricool_blog_id && process.env.METRICOOL_TOKEN && process.env.METRICOOL_USER_ID) {
      try {
        const end = new Date()
        const start = new Date(); start.setDate(start.getDate() - 30)
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${process.env.METRICOOL_USER_ID}&blogId=${client.metricool_blog_id}&start=${start.toISOString().slice(0,19)}&end=${end.toISOString().slice(0,19)}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': process.env.METRICOOL_TOKEN } })
        if (res.ok) {
          const json = await res.json() as { data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
          recentPosts = (json.data || [])
            .filter((p) => !p.draft && p.text?.trim() && new Date(p.publicationDate?.dateTime || '') <= end)
            .sort((a, b) => (b.publicationDate?.dateTime || '').localeCompare(a.publicationDate?.dateTime || ''))
            .slice(0, 5)
            .map((p) => ({ text: p.text, date: p.publicationDate?.dateTime || '', platforms: (p.providers || []).map((x) => x.network) }))
        }
      } catch { /* skip */ }
    }

    const overdue = (openTasks ?? []).filter((t) => t.due_at && t.due_at < nowIso)
    const priorityIcon = (p: number) => p === 1 ? '🔴' : p === 2 ? '🟡' : '🟢'

    const lines: string[] = [
      `**${client.name}** — ${client.status} | ${client.industry || 'No industry'}`,
      client.platforms?.length ? `Platforms: ${client.platforms.join(', ')}` : '',
      client.metricool_blog_id ? '⚡ Metricool connected' : '⚠️ No Metricool',
      '',
    ]

    if (overdue.length > 0) {
      lines.push(`⏰ **${overdue.length} overdue task${overdue.length !== 1 ? 's' : ''}:**`)
      overdue.forEach((t) => lines.push(`  • ${t.title}`))
      lines.push('')
    }

    if (openTasks?.length) {
      lines.push(`**📋 Open tasks (${openTasks.length}):**`)
      openTasks.forEach((t) => {
        const assignee = (t.assignee as { full_name?: string } | null)?.full_name
        const due = t.due_at ? ` · due ${new Date(t.due_at).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}` : ''
        lines.push(`  ${priorityIcon(t.priority)} ${t.title}${assignee ? ` → ${assignee}` : ''}${due}`)
      })
      lines.push('')
    } else {
      lines.push('**📋 Tasks:** No open tasks ✓')
      lines.push('')
    }

    if (recentPosts.length > 0) {
      const lastDate = new Date(recentPosts[0].date)
      const daysAgo = Math.floor((Date.now() - lastDate.getTime()) / 86400000)
      lines.push(`**📱 Last ${recentPosts.length} posts (last post: ${daysAgo}d ago):**`)
      recentPosts.forEach((p) => {
        const dateStr = new Date(p.date).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })
        const excerpt = p.text.slice(0, 80) + (p.text.length > 80 ? '…' : '')
        lines.push(`  • ${dateStr} (${p.platforms.join(', ')}) — ${excerpt}`)
      })
    } else if (client.metricool_blog_id) {
      lines.push('**📱 Posts:** No posts in the last 30 days ⚠️')
    }

    return lines.filter((l) => l !== '' || lines.indexOf(l) < lines.length - 1).join('\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetWeeklyReport(weeksBack: number = 1): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool not configured.'

    const supabase = await createClient()
    const now = new Date()
    const clampedWeeks = Math.min(Math.max(1, weeksBack), 4)
    const endDate = new Date(now)
    endDate.setDate(now.getDate() - (clampedWeeks - 1) * 7)
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 6)
    const startStr = startDate.toISOString().slice(0, 19)
    const endStr = endDate.toISOString().slice(0, 19)

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, metricool_blog_id')
      .not('metricool_blog_id', 'is', null)
      .eq('status', 'active')

    if (!clients?.length) return 'No Metricool clients configured.'

    const results = await Promise.allSettled(
      clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${startStr}&end=${endStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return []
        const json = await res.json() as { data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
        return (json.data || [])
          .filter((p) => !p.draft && new Date(p.publicationDate?.dateTime || '') <= now)
          .map((p) => ({
            client: c.name,
            date: (p.publicationDate?.dateTime || '').slice(0, 10),
            platforms: (p.providers || []).map((x) => x.network),
          }))
      })
    )

    const posts = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<{ client: string; date: string; platforms: string[] }[]>).value)

    if (!posts.length) return 'No published posts found for this week.'

    // Build day-by-day data
    const days: { date: string; label: string }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric' })
      days.push({ date: dateStr, label })
    }

    // Client stats
    const clientStats = new Map<string, { total: number; platforms: Record<string, number>; days: Record<string, number> }>()
    for (const p of posts) {
      if (!clientStats.has(p.client)) clientStats.set(p.client, { total: 0, platforms: {}, days: {} })
      const s = clientStats.get(p.client)!
      s.total++
      s.days[p.date] = (s.days[p.date] ?? 0) + 1
      for (const pl of p.platforms) s.platforms[pl] = (s.platforms[pl] ?? 0) + 1
    }

    const sortedClients = Array.from(clientStats.entries()).sort((a, b) => b[1].total - a[1].total)

    const weekLabel = clampedWeeks === 1 ? 'This week' : `${clampedWeeks} weeks ago`
    const dateRange = `${startDate.toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}`

    const header = `**📊 Weekly Content Report — ${weekLabel} (${dateRange})**\n${posts.length} posts published across ${sortedClients.length} clients\n`

    // Day header row
    const dayRow = days.map((d) => d.label.split(' ')[0]).join(' | ')

    const rows = sortedClients.slice(0, 20).map(([name, stats]) => {
      const dayCounts = days.map((d) => stats.days[d.date] ?? 0)
      const dayStr = dayCounts.map((n) => (n === 0 ? '—' : String(n))).join(' | ')
      const platforms = Object.entries(stats.platforms).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}(${n})`).join(', ')
      return `• **${name}** — ${stats.total} posts | ${dayStr}\n  ${platforms}`
    })

    return [header, `_${dayRow}_`, '', ...rows].join('\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execGetPostsByDate(date: string, endDate?: string, clientName?: string): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool not configured.'

    const supabase = await createClient()
    const startStr = `${date}T00:00:00`
    const endStr = endDate ? `${endDate}T23:59:59` : `${date}T23:59:59`

    let dbQuery = supabase.from('clients').select('id, name, metricool_blog_id').not('metricool_blog_id', 'is', null).eq('status', 'active')
    if (clientName) dbQuery = dbQuery.ilike('name', `%${clientName}%`)
    const { data: clients } = await dbQuery.limit(clientName ? 3 : 50)
    if (!clients?.length) return clientName ? `No client found matching "${clientName}".` : 'No Metricool clients configured.'

    const results = await Promise.allSettled(
      clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${startStr}&end=${endStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return []
        const json = await res.json() as { data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
        return (json.data || [])
          .filter((p) => !p.draft)
          .map((p) => ({
            client: c.name,
            text: p.text || '',
            date: p.publicationDate?.dateTime || '',
            platforms: (p.providers || []).map((x) => x.network),
          }))
      })
    )

    const posts = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<{ client: string; text: string; date: string; platforms: string[] }[]>).value)
      .sort((a, b) => a.date.localeCompare(b.date))

    const dateLabel = endDate ? `${date} to ${endDate}` : date

    if (!posts.length) return `No posts found on ${dateLabel}${clientName ? ` for ${clientName}` : ''}.`

    const formatTime = (d: string) => new Date(d).toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true })

    const lines = posts.map((p) => {
      const excerpt = p.text.slice(0, 100) + (p.text.length > 100 ? '…' : '')
      return `• **${p.client}** @ ${formatTime(p.date)} (${p.platforms.join(', ')})\n  ${excerpt}`
    })

    return `**Posts on ${dateLabel} (${posts.length} total):**\n\n${lines.join('\n\n')}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execCreateRecordingSession(
  title: string, sessionDate: string, clientName?: string,
  startTime?: string, endTime?: string, location?: string,
  videographerName?: string, notes?: string
): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let clientId: string | null = null
    if (clientName) {
      const { data } = await supabase.from('clients').select('id, name').ilike('name', `%${clientName}%`).limit(1).single()
      clientId = data?.id ?? null
      if (!clientId) return `Could not find client "${clientName}". Session not created.`
    }

    let videographerId: string | null = null
    if (videographerName) {
      const { data } = await supabase.from('profiles').select('id, full_name').ilike('full_name', `%${videographerName}%`).limit(1).single()
      videographerId = data?.id ?? null
      if (!videographerId) return `Could not find team member "${videographerName}". Session not created.`
    }

    const { error } = await supabase.from('recording_sessions').insert({
      title,
      client_id: clientId,
      session_date: sessionDate,
      start_time: startTime ?? null,
      end_time: endTime ?? null,
      location: location ?? null,
      videographer_id: videographerId,
      notes: notes ?? null,
      status: 'scheduled',
      created_by: user?.id ?? '',
    })

    if (error) return `Error creating recording session: ${error.message}`

    const dateStr = new Date(sessionDate + 'T12:00:00').toLocaleDateString('es-PR', { weekday: 'long', month: 'long', day: 'numeric' })
    const timeStr = startTime ? ` @ ${startTime}${endTime ? `–${endTime}` : ''}` : ''
    const locStr = location ? ` · 📍 ${location}` : ''
    const vStr = videographerName ? ` · 🎬 ${videographerName}` : ''

    return `✅ Recording session scheduled:\n\n**${title}**\n📅 ${dateStr}${timeStr}${locStr}${vStr}${clientName ? `\n👤 Client: ${clientName}` : ''}${notes ? `\n📝 ${notes}` : ''}\n\nVisible in the Recording Calendar.`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execDismissAlert(titleKeyword: string): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('alerts')
      .select('id, title, severity')
      .ilike('title', `%${titleKeyword}%`)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!data?.length) return `No alert found matching "${titleKeyword}".`

    const alert = data[0]
    const { error } = await supabase.from('alerts').delete().eq('id', alert.id)
    if (error) return `Error dismissing alert: ${error.message}`

    return `✅ Alert dismissed: **"${alert.title}"**.${data.length > 1 ? `\n\n_Found ${data.length} matches — dismissed the most recent one._` : ''}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execDeleteTask(taskTitle: string, clientName?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const query = supabase
      .from('tasks')
      .select('id, title, status, client:clients(name)')
      .ilike('title', `%${taskTitle}%`)
      .limit(5)

    const { data } = await query
    if (!data?.length) return `No task found matching "${taskTitle}".`

    let candidates = data
    if (clientName) {
      const filtered = data.filter((t) => {
        const cn = (t.client as { name?: string } | null)?.name ?? ''
        return cn.toLowerCase().includes(clientName.toLowerCase())
      })
      if (filtered.length) candidates = filtered
    }

    const task = candidates[0]
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) return `Error deleting task: ${error.message}`

    const clientStr = (task.client as { name?: string } | null)?.name ? ` (${(task.client as { name?: string }).name})` : ''
    return `🗑️ Task deleted: **"${task.title}"**${clientStr}.${candidates.length > 1 ? `\n\n_Found ${candidates.length} matches — deleted the first one. Be more specific if needed._` : ''}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execUpdateTask(taskTitle: string, clientName?: string, newPriority?: number, newDueAt?: string, newTitle?: string, newDescription?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('tasks')
      .select('id, title, client:clients(name)')
      .ilike('title', `%${taskTitle}%`)
      .neq('status', 'completed')
      .limit(5)

    if (!data?.length) return `No open task found matching "${taskTitle}".`

    let candidates = data
    if (clientName) {
      const filtered = data.filter((t) => {
        const cn = (t.client as { name?: string } | null)?.name ?? ''
        return cn.toLowerCase().includes(clientName.toLowerCase())
      })
      if (filtered.length) candidates = filtered
    }

    const task = candidates[0]
    const updates: Record<string, unknown> = {}
    if (newPriority !== undefined) updates.priority = newPriority
    if (newDueAt !== undefined) updates.due_at = newDueAt || null
    if (newTitle) updates.title = newTitle
    if (newDescription !== undefined) updates.description = newDescription

    if (!Object.keys(updates).length) return 'Nothing to update — specify a new priority, due date, title, or notes.'

    const { error } = await supabase.from('tasks').update(updates).eq('id', task.id)
    if (error) return `Error updating task: ${error.message}`

    const changes: string[] = []
    if (newPriority !== undefined) changes.push(`priority → ${newPriority === 1 ? 'High 🔴' : newPriority === 2 ? 'Medium 🟡' : 'Low 🟢'}`)
    if (newDueAt !== undefined) changes.push(`due date → ${newDueAt ? new Date(newDueAt).toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric' }) : 'cleared'}`)
    if (newTitle) changes.push(`title → "${newTitle}"`)
    if (newDescription !== undefined) changes.push('notes updated')

    return `✅ Updated **"${task.title}"**: ${changes.join(', ')}.`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetMonthlyReport(monthsBack: number = 0): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool not configured.'

    const supabase = await createClient()
    const now = new Date()
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)
    const startDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1)
    const endDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0)
    const startStr = startDate.toISOString().slice(0, 19)
    const endStr = endDate.toISOString().slice(0, 19) + 'T23:59:59'.slice(10)

    const monthName = startDate.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' })

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, metricool_blog_id')
      .not('metricool_blog_id', 'is', null)
      .eq('status', 'active')

    if (!clients?.length) return 'No Metricool clients configured.'

    const results = await Promise.allSettled(
      clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${startStr}&end=${endStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return []
        const json = await res.json() as { data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
        return (json.data || [])
          .filter((p) => !p.draft && new Date(p.publicationDate?.dateTime || '') <= (monthsBack === 0 ? now : endDate))
          .map((p) => ({
            client: c.name,
            date: (p.publicationDate?.dateTime || '').slice(0, 10),
            platforms: (p.providers || []).map((x) => x.network),
          }))
      })
    )

    const posts = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<{ client: string; date: string; platforms: string[] }[]>).value)

    if (!posts.length) return `No published posts found for ${monthName}.`

    const clientStats = new Map<string, { total: number; platforms: Record<string, number> }>()
    for (const p of posts) {
      if (!clientStats.has(p.client)) clientStats.set(p.client, { total: 0, platforms: {} })
      const s = clientStats.get(p.client)!
      s.total++
      for (const pl of p.platforms) s.platforms[pl] = (s.platforms[pl] ?? 0) + 1
    }

    const platformTotals: Record<string, number> = {}
    for (const p of posts) {
      for (const pl of p.platforms) platformTotals[pl] = (platformTotals[pl] ?? 0) + 1
    }

    const sortedClients = Array.from(clientStats.entries()).sort((a, b) => b[1].total - a[1].total)
    const avgPerClient = (posts.length / sortedClients.length).toFixed(1)

    const header = `**📅 Monthly Content Report — ${monthName}**\n${posts.length} posts published across ${sortedClients.length} clients · avg ${avgPerClient} posts/client`

    const platformSummary = Object.entries(platformTotals).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}(${n})`).join(', ')

    const rows = sortedClients.slice(0, 25).map(([name, stats]) => {
      const platforms = Object.entries(stats.platforms).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}(${n})`).join(', ')
      const bar = '▓'.repeat(Math.min(stats.total, 10)) + (stats.total > 10 ? `+${stats.total - 10}` : '')
      return `• **${name}** — ${stats.total} posts ${bar}\n  ${platforms}`
    })

    const noPostClients = clients.length - sortedClients.length
    const footer = noPostClients > 0 ? `\n⚠️ ${noPostClients} client${noPostClients !== 1 ? 's' : ''} with no posts this month.` : '\n✅ All clients posted this month.'

    return [header, `Platforms: ${platformSummary}`, '', ...rows, footer].join('\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

async function execGetProductionTasks(weekStart?: string, assigneeName?: string, status?: string, clientName?: string): Promise<string> {
  try {
    const supabase = await createClient()

    // Compute week start
    let ws = weekStart
    if (!ws) {
      const now = new Date()
      const day = now.getDay()
      const diff = day === 0 ? -6 : 1 - day
      now.setDate(now.getDate() + diff)
      ws = now.toISOString().slice(0, 10)
    }

    const monday = new Date(ws + 'T12:00:00Z')
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const weekEnd = sunday.toISOString().slice(0, 10)

    let query = supabase
      .from('production_tasks')
      .select('*, client:clients!production_tasks_client_id_fkey(id, name), assigned_to:profiles!production_tasks_assigned_to_id_fkey(id, full_name)')
      .gte('publish_date', ws)
      .lte('publish_date', weekEnd)
      .order('publish_date')
      .order('content_type')
      .limit(200)

    if (status && status !== 'all') {
      query = query.eq('status', status as string)
    } else if (!status) {
      query = query.neq('status', 'publicado')
    }

    if (clientName) {
      const { data: clients } = await supabase.from('clients').select('id').ilike('name', `%${clientName}%`).limit(5)
      if (clients?.length) query = query.in('client_id', clients.map(c => c.id))
    }

    const { data, error } = await query
    if (error) return `Error: ${error.message}`
    if (!data?.length) return `No production tasks found for the week of ${ws}.`

    let tasks = data as { id: string; content_type: string; publish_date: string; status: string; client: { name: string } | null; assigned_to: { full_name: string } | null }[]

    if (assigneeName) {
      tasks = tasks.filter(t => t.assigned_to?.full_name?.toLowerCase().includes(assigneeName.toLowerCase()))
      if (!tasks.length) return `No production tasks assigned to "${assigneeName}" this week.`
    }

    const statusCounts: Record<string, number> = {}
    const rows = tasks.map(t => {
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1
      const typeLabel = t.content_type === 'R' ? 'Reel' : 'Post'
      const dayName = new Date(t.publish_date + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric' })
      const assignee = t.assigned_to?.full_name ?? 'Sin asignar'
      return `• [${t.status.toUpperCase()}] **${t.client?.name ?? '?'}** — ${typeLabel} (${dayName}) → ${assignee}`
    })

    const summary = Object.entries(statusCounts).map(([s, n]) => `${s}: ${n}`).join(' | ')

    return `**Producción — Semana del ${ws}** (${tasks.length} tareas)\n${summary}\n\n${rows.join('\n')}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execUpdateProductionStatus(clientName: string, newStatus: string, contentType?: string, publishDate?: string): Promise<string> {
  try {
    const supabase = await createClient()

    const { data: clients } = await supabase.from('clients').select('id, name').ilike('name', `%${clientName}%`).limit(3)
    if (!clients?.length) return `No client found matching "${clientName}".`

    let query = supabase
      .from('production_tasks')
      .select('id, client_id, content_type, publish_date, status')
      .in('client_id', clients.map(c => c.id))
      .neq('status', 'publicado')

    if (contentType) query = query.eq('content_type', contentType)
    if (publishDate) query = query.eq('publish_date', publishDate)

    const { data: tasks } = await query.order('publish_date').limit(5)
    if (!tasks?.length) return `No matching production task found for "${clientName}".`

    const task = tasks[0]
    const { error } = await supabase.from('production_tasks').update({ status: newStatus }).eq('id', task.id)
    if (error) return `Error: ${error.message}`

    const clientMatch = clients.find(c => c.id === task.client_id)
    const typeLabel = task.content_type === 'R' ? 'Reel' : 'Post'
    return `✅ **${clientMatch?.name}** — ${typeLabel} del ${task.publish_date} → **${newStatus}**`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execCreateProductionTask(clientName: string, contentType: string, publishDate: string, assigneeName?: string, priority?: string, notes?: string): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Error: No autenticado'

    // Find client
    const { data: clients } = await supabase.from('clients').select('id, name').ilike('name', `%${clientName}%`).limit(3)
    if (!clients?.length) return `No se encontró el cliente "${clientName}".`
    const client = clients[0]

    // Find assignee if provided
    let assignedToId: string | null = null
    if (assigneeName) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').ilike('full_name', `%${assigneeName}%`).limit(3)
      assignedToId = profiles?.[0]?.id ?? null
      if (!assignedToId) return `No se encontró el miembro del equipo "${assigneeName}".`
    }

    const deadline = new Date(publishDate + 'T12:00:00')
    deadline.setDate(deadline.getDate() - 1)

    const { error } = await supabase.from('production_tasks').insert({
      client_id: client.id,
      content_type: contentType as 'R' | 'P',
      publish_date: publishDate,
      deadline: deadline.toISOString(),
      assigned_to_id: assignedToId,
      status: 'pendiente',
      notes: notes || null,
      is_special_request: true,
      priority: (priority || 'media') as 'alta' | 'media' | 'baja',
      created_by: user.id,
    })

    if (error) return `Error creando tarea: ${error.message}`

    const typeLabel = contentType === 'R' ? 'Reel' : 'Post'
    const assigneeStr = assignedToId && assigneeName ? ` → asignado a **${assigneeName}**` : ''
    return `✅ Solicitud especial creada: **${client.name}** — ${typeLabel} para el **${publishDate}**${assigneeStr}${notes ? `\n📝 ${notes}` : ''}`
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetProductionSchedule(clientName?: string): Promise<string> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('production_schedules')
      .select('*, client:clients!production_schedules_client_id_fkey(id, name), assigned_editor:profiles!production_schedules_assigned_editor_id_fkey(id, full_name), assigned_designer:profiles!production_schedules_assigned_designer_id_fkey(id, full_name)')
      .order('client_id')
      .order('day_of_week')

    if (clientName) {
      const { data: clients } = await supabase.from('clients').select('id').ilike('name', `%${clientName}%`).limit(5)
      if (clients?.length) query = query.in('client_id', clients.map(c => c.id))
    }

    const { data, error } = await query.limit(200)
    if (error) return `Error: ${error.message}`
    if (!data?.length) return clientName ? `No hay horario configurado para "${clientName}".` : 'No hay horarios de producción configurados aún.'

    const DAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    const byClient = new Map<string, typeof data>()
    for (const s of data) {
      const cname = (s.client as { name?: string } | null)?.name ?? 'Sin cliente'
      if (!byClient.has(cname)) byClient.set(cname, [])
      byClient.get(cname)!.push(s)
    }

    const lines: string[] = [`**📅 Horarios de Producción** (${byClient.size} clientes, ${data.length} publicaciones/semana)\n`]
    for (const [name, schedules] of Array.from(byClient.entries())) {
      const rows = schedules.map(s => {
        const typeLabel = s.content_type === 'R' ? 'Reel' : 'Post'
        const editor = (s.assigned_editor as { full_name?: string } | null)?.full_name?.split(' ')[0] ?? '—'
        const designer = (s.assigned_designer as { full_name?: string } | null)?.full_name?.split(' ')[0] ?? '—'
        return `  ${DAY_NAMES[s.day_of_week]}: ${typeLabel} (Ed: ${editor} / Dis: ${designer})`
      }).join('\n')
      lines.push(`**${name}** — ${schedules.length}/semana\n${rows}`)
    }

    return lines.join('\n\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

async function execGetContentAnalytics(range?: string, clientName?: string): Promise<string> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (!token || !userId) return 'Metricool no está configurado.'

    const supabase = await createClient()
    const days = range === '7d' ? 7 : range === '14d' ? 14 : range === '90d' ? 90 : 30
    const now = new Date()
    const end = new Date(now)
    const start = new Date(now)
    start.setDate(start.getDate() - days)
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - days)

    const startStr = start.toISOString().slice(0, 19)
    const endStr = end.toISOString().slice(0, 19)
    const prevStartStr = prevStart.toISOString().slice(0, 19)

    let query = supabase.from('clients').select('id, name, metricool_blog_id').not('metricool_blog_id', 'is', null).eq('status', 'active')
    if (clientName) query = query.ilike('name', `%${clientName}%`)
    const { data: clients } = await query.limit(clientName ? 3 : 50)
    if (!clients?.length) return clientName ? `No se encontró "${clientName}".` : 'Sin clientes Metricool configurados.'

    const [currentResults, prevResults] = await Promise.all([
      Promise.allSettled(clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${startStr}&end=${endStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return { name: c.name, posts: [] }
        const json = await res.json() as { data?: { publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[] }
        const posts = (json.data || []).filter((p) => !p.draft && new Date(p.publicationDate?.dateTime || '') <= now)
        return { name: c.name, posts }
      })),
      Promise.allSettled(clients.map(async (c) => {
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${c.metricool_blog_id}&start=${prevStartStr}&end=${startStr}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (!res.ok) return { name: c.name, count: 0 }
        const json = await res.json() as { data?: { draft?: boolean; publicationDate: { dateTime: string } }[] }
        const prevStart2 = new Date(prevStart)
        const count = (json.data || []).filter((p) => !p.draft && new Date(p.publicationDate?.dateTime || '') <= start).length
        return { name: c.name, count }
      })),
    ])

    type ClientData = { name: string; posts: { publicationDate: { dateTime: string }; providers?: { network: string }[] }[] }
    const current = currentResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<ClientData>).value)

    const prevMap = new Map<string, number>()
    prevResults.filter((r) => r.status === 'fulfilled').forEach((r) => {
      const v = (r as PromiseFulfilledResult<{ name: string; count: number }>).value
      prevMap.set(v.name, v.count)
    })

    const totalPosts = current.reduce((s, c) => s + c.posts.length, 0)
    const avgPerClient = totalPosts / Math.max(current.length, 1)

    // Day of week analysis
    const dayCount = Array(7).fill(0)
    const platformCount: Record<string, number> = {}
    for (const c of current) {
      for (const p of c.posts) {
        const d = new Date(p.publicationDate?.dateTime || '')
        dayCount[d.getDay()]++
        for (const prov of (p.providers || [])) {
          platformCount[prov.network] = (platformCount[prov.network] ?? 0) + 1
        }
      }
    }
    const DAY_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const bestDayIdx = dayCount.indexOf(Math.max(...dayCount))
    const topPlatforms = Object.entries(platformCount).sort((a, b) => b[1] - a[1]).slice(0, 3)

    const lines: string[] = [
      `**📊 Análisis de Contenido — últimos ${days} días**`,
      `Total publicado: **${totalPosts} posts** en ${current.length} clientes (promedio: ${avgPerClient.toFixed(1)}/cliente)`,
      `Día más activo: **${DAY_ES[bestDayIdx]}** (${dayCount[bestDayIdx]} posts)`,
      topPlatforms.length ? `Plataformas: ${topPlatforms.map(([p, n]) => `${p} (${n})`).join(', ')}` : '',
      '',
      '**Por cliente:**',
    ].filter(Boolean)

    const sorted = [...current].sort((a, b) => b.posts.length - a.posts.length)
    for (const c of sorted) {
      const prev = prevMap.get(c.name) ?? 0
      const trend = c.posts.length > prev ? '↑' : c.posts.length < prev ? '↓' : '→'
      const aboveAvg = c.posts.length > avgPerClient ? ' ✅' : c.posts.length === 0 ? ' ⚠️' : ''
      const perWeek = (c.posts.length / (days / 7)).toFixed(1)
      lines.push(`• **${c.name}**: ${c.posts.length} posts (${perWeek}/sem) ${trend}${aboveAvg}`)
    }

    return lines.join('\n')
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }
}

// ── Tool router ──────────────────────────────────────────────────────────────

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'search_client':
      return execSearchClient(input.name as string)
    case 'list_clients':
      return execListClients(input.status as string | undefined, input.with_metricool as boolean | undefined)
    case 'get_tasks':
      return execGetTasks(input.status as string | undefined, input.client_name as string | undefined)
    case 'generate_caption':
      return execGenerateCaption(input.client_name as string, input.topic as string, input.platform as string | undefined)
    case 'get_video_queue':
      return execGetVideoQueue()
    case 'get_recent_posts':
      return execGetRecentPosts(input.client_name as string | undefined, input.range as string | undefined, input.platform as string | undefined)
    case 'get_upcoming_schedule':
      return execGetUpcomingSchedule(input.client_name as string | undefined, input.platform as string | undefined)
    case 'create_task':
      return execCreateTask(input.title as string, input.client_name as string | undefined, input.type as string | undefined, input.priority as number | undefined, input.due_at as string | undefined, input.description as string | undefined)
    case 'update_task_status':
      return execUpdateTaskStatus(input.task_title as string, input.new_status as string, input.client_name as string | undefined)
    case 'get_dashboard_summary':
      return execGetDashboardSummary()
    case 'get_active_alerts':
      return execGetActiveAlerts()
    case 'create_alert':
      return execCreateAlert(input.title as string, input.message as string | undefined, input.severity as string | undefined)
    case 'get_client_efficiency':
      return execGetClientEfficiency(input.show_issues_only as boolean | undefined)
    case 'get_stale_clients':
      return execGetStaleClients(input.days as number | undefined)
    case 'get_client_requests':
      return execGetClientRequests(input.status as string | undefined)
    case 'assign_task':
      return execAssignTask(input.task_title as string, input.assignee_name as string)
    case 'get_video_reviews':
      return execGetVideoReviews(input.status as string | undefined, input.client_name as string | undefined)
    case 'get_team_workload':
      return execGetTeamWorkload(input.member_name as string | undefined)
    case 'search_posts':
      return execSearchPosts(input.query as string, input.client_name as string | undefined)
    case 'get_todays_posts':
      return execGetTodaysPosts(input.client_name as string | undefined)
    case 'get_member_tasks':
      return execGetMemberTasks(input.member_name as string, input.status as string | undefined)
    case 'get_recording_sessions':
      return execGetRecordingSessions(input.range as string | undefined, input.videographer_name as string | undefined, input.client_name as string | undefined, input.status as string | undefined)
    case 'get_client_snapshot':
      return execGetClientSnapshot(input.client_name as string)
    case 'get_weekly_report':
      return execGetWeeklyReport(input.weeks_back as number | undefined)
    case 'get_posts_by_date':
      return execGetPostsByDate(input.date as string, input.end_date as string | undefined, input.client_name as string | undefined)
    case 'create_recording_session':
      return execCreateRecordingSession(input.title as string, input.session_date as string, input.client_name as string | undefined, input.start_time as string | undefined, input.end_time as string | undefined, input.location as string | undefined, input.videographer_name as string | undefined, input.notes as string | undefined)
    case 'dismiss_alert':
      return execDismissAlert(input.title_keyword as string)
    case 'delete_task':
      return execDeleteTask(input.task_title as string, input.client_name as string | undefined)
    case 'update_task':
      return execUpdateTask(input.task_title as string, input.client_name as string | undefined, input.new_priority as number | undefined, input.new_due_at as string | undefined, input.new_title as string | undefined, input.new_description as string | undefined)
    case 'get_monthly_report':
      return execGetMonthlyReport(input.months_back as number | undefined)
    case 'get_production_tasks':
      return execGetProductionTasks(input.week_start as string | undefined, input.assignee_name as string | undefined, input.status as string | undefined, input.client_name as string | undefined)
    case 'update_production_status':
      return execUpdateProductionStatus(input.client_name as string, input.new_status as string, input.content_type as string | undefined, input.publish_date as string | undefined)
    case 'create_production_task':
      return execCreateProductionTask(input.client_name as string, input.content_type as string, input.publish_date as string, input.assignee_name as string | undefined, input.priority as string | undefined, input.notes as string | undefined)
    case 'get_production_schedule':
      return execGetProductionSchedule(input.client_name as string | undefined)
    case 'get_content_analytics':
      return execGetContentAnalytics(input.range as string | undefined, input.client_name as string | undefined)
    default:
      return 'Unknown tool'
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

function buildSystem(): string {
  const now = new Date()
  const today = now.toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const time = now.toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Puerto_Rico' })

  return `You are NMedia AI, the intelligent assistant for NMedia PR — a Puerto Rican digital marketing and social media agency managing 48+ active clients.

Today is ${today} · Current time in Puerto Rico: ${time}

Team members: Anibeliz, Denisha, Carlos, Alondra, Mariliz, Jeander, Joxandra, Richard, Nico, Lisneidy, Alexa, Gustverlin, Anny.
Editors (video/Reels): Carlos, Lisneidy, Alexa, Jeander, Gustverlin. Designers (Posts/graphics): Anny, Joxandra.
When a user mentions a team member name, use get_member_tasks or assign_task — do not guess at IDs.

You have real-time access to:
- All client profiles (brand voice, hashtags, CTA, rules, language, Metricool connection)
- Operations board (tasks: pending, in-progress, blocked, completed with due dates and assignees)
- Video QC board (videos submitted by editors for review — error tracking, revisions, approval flow)
- Recently published and scheduled posts from Metricool across all clients
- Caption generation (write on-brand captions using each client's real style examples)
- Team alerts and notifications
- Client efficiency scores (health metrics per client)
- Stale client detection (which clients haven't posted recently)
- Client portal requests (submissions from prospective/existing clients)
- Task assignment and collaboration tracking
- Recording calendar (videographer session scheduling)
- Production module (Reels & Posts per client per week — statuses: pendiente→en_edicion→en_revision→revisiones→aprobado→publicado)

Tool routing:
- Specific client info → search_client
- List clients → list_clients
- Tasks/operations board → get_tasks
- Videos aprobados listos para caption → get_video_queue
- Video QC reviews (editor submissions, approvals) → get_video_reviews
- Recently published content → get_recent_posts
- Upcoming scheduled content → get_upcoming_schedule
- Write/generate a caption → generate_caption (search_client first for profile)
- Create a task → create_task
- Change task status (done/blocked/in progress) → update_task_status
- Status overview or weekly summary → get_dashboard_summary
- View alerts → get_active_alerts
- Create/broadcast a team alert → create_alert
- Client health or efficiency → get_client_efficiency
- Clients inactive/not posting recently → get_stale_clients
- View client portal requests → get_client_requests
- Assign task to team member → assign_task
- Team workload / who has what tasks → get_team_workload
- Search published posts by keyword → search_posts
- What was posted today / today's schedule → get_todays_posts
- Specific team member's tasks (e.g. "what does Anibeliz have?") → get_member_tasks
- Recording sessions / videographer schedule → get_recording_sessions
- Posts on a specific date ("what was posted on Monday?", "show posts from May 15") → get_posts_by_date
- Weekly content report / "how did we do this week?" / post count by client this week → get_weekly_report
- Monthly content report / "how did we do this month?" / "how many posts in April?" → get_monthly_report
- Full client update ("how is [client] doing?", "give me an update on [client]") → get_client_snapshot
- Delete a task → delete_task
- Update task priority, due date, or notes → update_task
- Dismiss/remove/clear a team alert → dismiss_alert
- Schedule a recording/filming session → create_recording_session
- Production board / who is editing what / which Reels are in revision → get_production_tasks
- Production tasks for a specific person ("what does Carlos have this week?") → get_production_tasks with assignee_name
- Production tasks for a client ("what's in production for [client]?") → get_production_tasks with client_name
- Pieces waiting for review / Para Revisar → get_production_tasks with status=en_revision or status=revisiones
- Mark a production Reel/Post as edited, approved, published → update_production_status
- "How many Reels are publishing today?" → get_dashboard_summary (includes today's production count)
- Create a new production task / add a Reel or Post for a client → create_production_task
- View the recurring production schedule (who works which days) → get_production_schedule

Relative date rules (use today's date above to compute):
- "today" = ${now.toISOString().slice(0, 10)}
- "tomorrow" = next calendar day
- "this week" = Mon–Sun of current week
- "next week" = Mon–Sun of next week
- Always express dates as ISO 8601 when calling tools

Common patterns to handle well:
- "What was posted today/yesterday/last Monday?" → get_posts_by_date with the computed ISO date
- "How's [client name] doing?" → get_client_snapshot (covers profile + tasks + recent posts)
- "Daily briefing" or "Status summary" → get_dashboard_summary + get_todays_posts
- "Is [person] busy?" or "[person]'s tasks" → get_member_tasks
- "What's due this week?" → get_tasks with status filter + explain overdue ones
- "Create a task for [person] about [topic]" → create_task, then assign_task
- "Delete/remove task [name]" → delete_task
- "Change priority/due date of [task]" → update_task
- "How did we do this month/last month?" → get_monthly_report with months_back parameter
- "Move [task] to done/completed" → update_task_status with new_status=completed

Style:
- Concise and actionable — busy agency staff, no fluff
- Use bullet points and bold for scannable answers
- Always match the user's language (Spanish or English)
- After completing an action (task created, alert sent), confirm clearly then stop
- Never apologize for data limitations — if data is missing, say what you DO know
- For status summaries, lead with the most urgent items first
- When listing posts, always show client name, platform(s), and time`
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!messages?.length) {
      return new Response('No messages', { status: 400 })
    }

    // Tool use loop — gather tool calls first, then stream the final text response
    const turnMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const system = buildSystem()

    // Run tool calls (non-streaming) until we're ready to produce the final answer
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system,
        tools,
        messages: turnMessages,
      })

      if (response.stop_reason !== 'tool_use') break

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      turnMessages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (tu) => ({
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: await runTool(tu.name, tu.input as Record<string, unknown>),
        }))
      )

      turnMessages.push({ role: 'user', content: toolResults })
    }

    // Stream the final response token-by-token
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 2000,
            system,
            tools,
            messages: turnMessages,
          })

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
        } catch (err) {
          controller.error(err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response('Error processing request', { status: 500 })
  }
}
