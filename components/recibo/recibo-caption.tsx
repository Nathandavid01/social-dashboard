'use client'

import { useEffect, useState, useTransition } from 'react'
import { saveIdeaCaption } from '@/lib/actions/idea-captions'
import { useToast } from '@/lib/hooks/use-toast'

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

  return (
    <textarea
      data-testid={`recibo-caption-${ideaId}`}
      aria-label="Caption"
      value={text}
      disabled={disabled || saving}
      rows={4}
      placeholder="Sin caption todavía"
      onChange={(event) => setText(event.target.value)}
      onBlur={save}
      className="w-full resize-y border-0 bg-transparent px-3 pb-3 pt-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
    />
  )
}
