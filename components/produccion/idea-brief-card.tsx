'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Lightbulb, Eye, Camera, Sparkles, Hash, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  hook?: string | null
  visualBrief?: string | null
  captionAngle?: string | null
  hashtags?: string | null
}

/**
 * Collapsible "La idea" brief. Once the idea is generated (hook + brief present)
 * it starts collapsed to keep the detail page compact; the header toggles it.
 */
export function IdeaBriefCard({ hook, visualBrief, captionAngle, hashtags }: Props) {
  const hasBrief = !!(hook || visualBrief || captionAngle || hashtags)
  const generated = !!(hook && visualBrief)
  const [open, setOpen] = useState(!generated)

  return (
    <Card id="stage-idea" className="scroll-mt-20 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-purple-500" /> La idea
          </CardTitle>
          {open
            ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 text-sm">
          {hook && <Field icon={Eye} label="Hook" value={hook} />}
          {visualBrief && <Field icon={Camera} label="Brief visual (para el editor)" value={visualBrief} />}
          {captionAngle && <Field icon={Sparkles} label="Ángulo del caption" value={captionAngle} />}
          {hashtags && <Field icon={Hash} label="Hashtags sugeridos" value={hashtags} mono />}
          {!hasBrief && <p className="text-muted-foreground">Sin brief adicional. Solo el título.</p>}
        </CardContent>
      )}
    </Card>
  )
}

function Field({ icon: Icon, label, value, mono }: { icon: typeof Eye; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={mono ? 'font-mono text-xs' : 'text-sm'}>{value}</p>
      </div>
    </div>
  )
}
