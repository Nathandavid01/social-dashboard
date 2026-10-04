'use client'

import { useEffect, useState, useTransition } from 'react'
import { saveIdeaCaption } from '@/lib/actions/idea-captions'
import { useToast } from '@/lib/hooks/use-toast'

const COLLAPSE_AT = 220

/**
 * Caption on a Recibo card. The text is the one caption for every network.
 */
export function ReciboCaption({
  ideaId,
  caption,
  disabled,
}: {
  ideaId: string
  caption: string
  disabled?: boolean
}) {
  const { toast } = useToast()
  const [text, setText] = useState(caption)
  const [expanded, setExpanded] = useState(false)
  const [saving, start] = useTransition()

  useEffect(() => {
    setText(caption)
  }, [caption])

  function save() {
    const clean = text.trim()
    if (!clean || clean === caption.trim() || saving) return
    start(async () => {
      const res = await saveIdeaCaption(ideaId, clean)
      if (res.error) toast({ title: 'No se pudo guardar el caption', description: res.error, variant: 'destructive' })
    })
  }

  const long = text.trim().length > COLLAPSE_AT
  const rows = expanded || !long ? Math.min(16, Math.max(4, text.split('\n').length + 1)) : 4

  return (
    <div className="space-y-1">
      <textarea
        data-testid={`recibo-caption-${ideaId}`}
        aria-label="Caption"
        value={text}
        disabled={disabled || saving}
        rows={rows}
        placeholder="Sin caption todavía"
        onChange={(event) => setText(event.target.value)}
        onBlur={save}
        className="w-full resize-y border-0 bg-transparent px-3 pb-1 pt-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
      />
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="px-3 pb-2 text-left text-xs font-medium text-violet-300"
        >
          {expanded ? 'Ver menos' : 'Ver caption completo'}
        </button>
      ) : null}
    </div>
  )
}
