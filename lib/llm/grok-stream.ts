/**
 * Server-Sent Events parsing for Grok's streaming chat completions.
 *
 * Pure so the chat route's streaming can be tested without an API key. A chunk
 * off the wire may end mid-event, so anything after the last `\n\n` is handed
 * back as `rest` for the caller to prepend to the next chunk — dropping it
 * would truncate words at chunk boundaries.
 */

export interface SseParseResult {
  /** Text deltas found in the complete events of this chunk. */
  text: string
  /** Trailing partial event to carry into the next chunk. */
  rest: string
  /** True once the stream signalled [DONE]. */
  done: boolean
}

export function parseSseTextDeltas(chunk: string): SseParseResult {
  const parts = chunk.split('\n\n')
  // The last piece is only complete if the chunk ended with a blank line.
  const rest = parts.pop() ?? ''

  let text = ''
  let done = false

  for (const event of parts) {
    for (const line of event.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue // skip comments / keep-alives
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') {
        done = true
        continue
      }
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: unknown } }[]
        }
        const content = json.choices?.[0]?.delta?.content
        if (typeof content === 'string') text += content
      } catch {
        // A malformed event shouldn't kill an otherwise good stream.
      }
    }
  }

  return { text, rest, done }
}
