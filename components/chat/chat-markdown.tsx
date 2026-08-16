'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Extracted out of ChatBubble (perf lote 1, #1): react-markdown + remark-gfm
 * are heavy deps. ChatBubble mounts unconditionally in the shared dashboard
 * layout, so a static import here used to ship in every route's initial JS.
 * chat-bubble.tsx loads this module lazily via next/dynamic instead.
 */
export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  )
}
