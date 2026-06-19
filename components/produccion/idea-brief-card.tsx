'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Lightbulb, Eye, Camera, Sparkles, Hash, CalendarCheck, Flag, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'
import { InlineEdit } from '@/components/shared/inline-edit'
import { updateIdeaBrief, updateIdeaDates } from '@/lib/actions/content-ideas'

interface Props {
  ideaId: string
  hook?: string | null
  visualBrief?: string | null
  captionAngle?: string | null
  hashtags?: string | null
  publishDate?: string | null
  deadline?: string | null
  /** Fired after a brief field is saved so parents can unlock caption/recording UI. */
  onBriefUpdated?: (fields: {
    hook?: string | null
    visual_brief?: string | null
    caption_angle?: string | null
    hashtags_suggestion?: string | null
  }) => void
}

/**
 * Editable step-1 card: publish date + the idea brief (hook, visual brief,
 * caption angle, hashtags). Collapses once the idea is generated. Each field is
 * an InlineEdit that persists immediately.
 */
export function IdeaBriefCard({
  ideaId,
  hook,
  visualBrief,
  captionAngle,
  hashtags,
  publishDate,
  deadline,
  onBriefUpdated,
}: Props) {
  const [hookVal, setHookVal] = useState(hook ?? '')
  const [visualVal, setVisualVal] = useState(visualBrief ?? '')
  const [angleVal, setAngleVal] = useState(captionAngle ?? '')
  const [tagsVal, setTagsVal] = useState(hashtags ?? '')

  useEffect(() => {
    setHookVal(hook ?? '')
    setVisualVal(visualBrief ?? '')
    setAngleVal(captionAngle ?? '')
    setTagsVal(hashtags ?? '')
  }, [ideaId, hook, visualBrief, captionAngle, hashtags])

  const generated = !!(hookVal && visualVal)
  const [open, setOpen] = useState(!generated)

  async function saveBrief(
    fields: { hook?: string | null; visual_brief?: string | null; caption_angle?: string | null; hashtags_suggestion?: string | null },
    local: () => void,
  ) {
    await updateIdeaBrief(ideaId, fields)
    local()
    onBriefUpdated?.(fields)
  }

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
          <EditableField icon={CalendarCheck} label="Fecha de publicación">
            <InlineEdit
              type="date"
              label="Fecha de publicación"
              value={publishDate ? publishDate.slice(0, 10) : ''}
              placeholder="Sin fecha"
              onSave={(v) => updateIdeaDates(ideaId, { publish_date: v || null })}
            />
          </EditableField>

          <EditableField icon={Flag} label="Fecha límite">
            <InlineEdit
              type="date"
              label="Fecha límite"
              value={deadline ? deadline.slice(0, 10) : ''}
              placeholder="Sin fecha límite"
              onSave={(v) => updateIdeaDates(ideaId, { deadline: v || null })}
            />
          </EditableField>

          <EditableField icon={Eye} label="Hook">
            <InlineEdit label="Hook" value={hookVal} placeholder="Añadir hook…"
              onSave={(v) => saveBrief({ hook: v }, () => setHookVal(v))} />
          </EditableField>

          <EditableField icon={Camera} label="Brief visual (para el editor)">
            <InlineEdit type="textarea" label="Brief visual (para el editor)" value={visualVal} placeholder="Añadir brief visual…"
              onSave={(v) => saveBrief({ visual_brief: v }, () => setVisualVal(v))} />
          </EditableField>

          <EditableField icon={Sparkles} label="Ángulo del caption">
            <InlineEdit type="textarea" label="Ángulo del caption" value={angleVal} placeholder="Añadir ángulo…"
              onSave={(v) => saveBrief({ caption_angle: v }, () => setAngleVal(v))} />
          </EditableField>

          <EditableField icon={Hash} label="Hashtags sugeridos">
            <InlineEdit label="Hashtags sugeridos" value={tagsVal} placeholder="Añadir hashtags…" mono
              onSave={(v) => saveBrief({ hashtags_suggestion: v }, () => setTagsVal(v))} />
          </EditableField>
        </CardContent>
      )}
    </Card>
  )
}

function EditableField({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="px-2 text-xs font-medium text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  )
}
