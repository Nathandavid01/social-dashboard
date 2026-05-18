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

  let query = supabase
    .from('tasks')
    .select('title, type, status, due_at, priority, client:clients(name)')
    .in('status', statuses)
    .order('due_at', { ascending: true })
    .limit(20)

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

  return tasks.map((t) => {
    const client = (t.client as { name?: string } | null)?.name
    const due = t.due_at ? ` | Due: ${new Date(t.due_at).toLocaleDateString('es-PR')}` : ''
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
    default:
      return 'Unknown tool'
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

const SYSTEM = `You are NMedia AI, the intelligent assistant for NMedia PR — a Puerto Rican digital marketing agency with 48 clients.

You have access to tools that let you look up real-time data: client profiles, open tasks, and caption generation.

You respond like a senior team member: direct, helpful, and knowledgeable. When someone asks about a client, search for them. When asked to generate a caption, use the generate_caption tool. When asked about tasks or operations, use get_tasks.

Always respond in the same language the user writes in (Spanish or English).`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!messages?.length) {
      return new Response('No messages', { status: 400 })
    }

    // Tool use loop — run until Claude responds with text
    const turnMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    let finalText = ''
    let iterations = 0

    while (iterations < 5) {
      iterations++
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM,
        tools,
        messages: turnMessages,
      })

      if (response.stop_reason === 'end_turn' || response.stop_reason !== 'tool_use') {
        // Final text response
        finalText = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as Anthropic.TextBlock).text)
          .join('')
        break
      }

      // Handle tool calls
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

    // Stream the final text back to the client
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      start(controller) {
        // Simulate streaming by chunking the already-complete response
        const words = finalText.split(' ')
        let i = 0
        const push = () => {
          if (i < words.length) {
            controller.enqueue(encoder.encode((i === 0 ? '' : ' ') + words[i]))
            i++
            setTimeout(push, 8)
          } else {
            controller.close()
          }
        }
        push()
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
