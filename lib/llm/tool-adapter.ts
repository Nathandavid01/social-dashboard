/**
 * Translation between Anthropic's tool-calling shape and Grok's (OpenAI-style).
 *
 * Pure on purpose: the chat route is 2.4k lines with no tests, so the risky part
 * of moving it to Grok — reshaping 35 tool definitions and the message loop —
 * lives here where it can be tested without an API key.
 *
 * The two differ in three ways:
 *   - tools: Anthropic is flat, OpenAI nests under `function`
 *   - the system prompt: a top-level field vs. the first message
 *   - tool results: content blocks inside a user turn vs. their own `role: tool`
 *     messages, one per result
 */

export interface AnthropicToolDef {
  name: string
  description?: string
  input_schema: { type: string; properties: Record<string, unknown>; required?: string[] }
}

export interface GrokTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: AnthropicToolDef['input_schema']
  }
}

export function toGrokTools(tools: AnthropicToolDef[]): GrokTool[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.input_schema,
    },
  }))
}

type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | Block[]
}

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

export function toGrokMessages(messages: AnthropicMessage[], system?: string): GrokMessage[] {
  const out: GrokMessage[] = []
  // Anthropic takes `system` as its own parameter; OpenAI wants it as message 0.
  if (system) out.push({ role: 'system', content: system })

  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
      continue
    }

    const text = m.content
      .filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    const toolUses = m.content.filter(
      (b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use',
    )
    const toolResults = m.content.filter(
      (b): b is Extract<Block, { type: 'tool_result' }> => b.type === 'tool_result',
    )

    // Each tool_result becomes its own message — OpenAI has no notion of several
    // results riding inside one user turn.
    if (toolResults.length > 0) {
      for (const r of toolResults) {
        out.push({ role: 'tool', tool_call_id: r.tool_use_id, content: r.content })
      }
      continue
    }

    if (toolUses.length > 0) {
      out.push({
        role: 'assistant',
        content: text,
        tool_calls: toolUses.map((t) => ({
          id: t.id,
          type: 'function' as const,
          function: { name: t.name, arguments: JSON.stringify(t.input ?? {}) },
        })),
      })
      continue
    }

    out.push({ role: m.role, content: text })
  }
  return out
}

export interface ParsedToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

/**
 * Tool calls from a Grok response. Malformed `arguments` degrade to `{}` rather
 * than throwing — a model that emits bad JSON shouldn't kill the conversation.
 */
export function parseGrokToolCalls(json: unknown): ParsedToolCall[] {
  const calls = (json as {
    choices?: { message?: { tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[]
  })?.choices?.[0]?.message?.tool_calls

  if (!Array.isArray(calls)) return []

  return calls.map((c) => {
    let input: Record<string, unknown> = {}
    try {
      const parsed = JSON.parse(c.function?.arguments ?? '{}')
      if (parsed && typeof parsed === 'object') input = parsed as Record<string, unknown>
    } catch {
      // keep {}
    }
    return { id: c.id ?? '', name: c.function?.name ?? '', input }
  })
}
