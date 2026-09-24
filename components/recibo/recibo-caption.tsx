'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Save } from 'lucide-react'
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

  const dirty = text.trim() !== caption.trim()

  function save() {
    const clean = text.trim()
    if (!clean) {
      toast({ title: 'El caption no puede ir vacío', variant: 'destructive' })
      return
    }
    start(async () => {
      const res = await saveIdeaCaption(ideaId, clean)
      if (res.error) toast({ title: 'No se pudo guardar el caption', description: res.error, variant: 'destructive' })
      else toast({ title: 'Caption guardado' })
    })
  }

  return (
    <div className="space-y-1.5" data-testid={`recibo-caption-${ideaId}`}>
      <label htmlFor={`recibo-caption-input-${ideaId}`} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Caption
      </label>
      <textarea
        id={`recibo-caption-input-${ideaId}`}
        value={text}
        disabled={disabled || saving}
        rows={5}
        placeholder="Sin caption todavía"
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y rounded-xl border border-border bg-background/80 px-3 py-2 text-sm leading-relaxed text-foreground outline-none ring-violet-400/40 placeholder:text-muted-foreground/60 focus:ring-2 disabled:opacity-60"
      />
      <button
        type="button"
        disabled={disabled || saving || !dirty}
        onClick={save}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-40"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
        Guardar caption
      </button>
    </div>
  )
}
