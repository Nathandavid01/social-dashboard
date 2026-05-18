import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function buildContext(): Promise<string> {
  try {
    const supabase = await createClient()

    const [{ data: clients }, { data: tasks }] = await Promise.all([
      supabase
        .from('clients')
        .select('name, industry, platforms, status, brand_voice, caption_language, default_cta, default_hashtags, caption_notes, metricool_blog_id')
        .order('name'),
      supabase
        .from('tasks')
        .select('title, type, status, due_at, client:clients(name)')
        .in('status', ['pending', 'in_progress', 'blocked'])
        .order('due_at', { ascending: true })
        .limit(30),
    ])

    const clientsBlock = (clients || []).map((c) => {
      const lines = [
        `**${c.name}** (${c.industry || 'Sin industria'}) — ${c.status}`,
        `  Plataformas: ${(c.platforms || []).join(', ')}`,
        c.brand_voice && `  Voz: ${c.brand_voice}`,
        c.caption_language && `  Idioma: ${c.caption_language}`,
        c.default_cta && `  CTA: ${c.default_cta}`,
        c.default_hashtags && `  Hashtags: ${c.default_hashtags}`,
        c.caption_notes && `  Reglas: ${c.caption_notes}`,
        c.metricool_blog_id && `  Metricool ID: ${c.metricool_blog_id}`,
      ].filter(Boolean).join('\n')
      return lines
    }).join('\n\n')

    const tasksBlock = (tasks || []).length > 0
      ? (tasks || []).map((t) => {
          const client = (t.client as { name?: string } | null)?.name
          const due = t.due_at ? ` — vence ${new Date(t.due_at).toLocaleDateString('es-PR')}` : ''
          return `- [${t.status.toUpperCase()}] ${t.title}${client ? ` (${client})` : ''}${due}`
        }).join('\n')
      : 'No hay tareas abiertas.'

    return `## CLIENTES DE LA AGENCIA (${(clients || []).length} total)\n\n${clientsBlock}\n\n## TAREAS ABIERTAS\n\n${tasksBlock}`
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    if (!messages?.length) {
      return new Response('No messages', { status: 400 })
    }

    const context = await buildContext()

    const systemPrompt = `Eres el asistente de inteligencia artificial de NMedia PR, una agencia de marketing digital en Puerto Rico. Tu nombre es NMedia AI.

Tienes acceso completo a los datos actuales de la agencia — clientes, sus perfiles de marca, y tareas en progreso. Respondes como si fueras un miembro senior del equipo: directo, útil, y al tanto de todo.

Puedes ayudar con:
- Información sobre cualquier cliente (voz de marca, hashtags, CTA, reglas, idioma)
- Estado de tareas y operaciones
- Generar o revisar captions para cualquier cliente
- Responder cualquier pregunta sobre la agencia

Responde siempre en el mismo idioma que el usuario te escriba (español o inglés).

${context ? `\n---\n\n## DATOS ACTUALES DE LA AGENCIA\n\n${context}` : ''}`

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response('Error', { status: 500 })
  }
}
