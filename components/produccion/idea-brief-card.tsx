'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Lightbulb, Camera, Sparkles, Hash, CalendarCheck, Flag, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'
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
  /** 'ai' cuando este hook lo escribió el análisis de video (v3.40) — muestra
   *  una marca discreta junto al campo, editable como cualquier hook. */
  hookSource?: 'ai' | null
  /** Fired after a brief field is saved so parents can unlock caption/recording UI. */
  onBriefUpdated?: (fields: {
    hook?: string | null
    visual_brief?: string | null
    caption_angle?: string | null
    hashtags_suggestion?: string | null
  }) => void
}

/**
 * Simple by default: ONE question — "¿De qué es este video?" (stored as the
 * hook) — which is all the AI needs to write the caption, same as the idea
 * generator. Everything else (dates, visual brief, angle, hashtags) is
 * optional detail tucked behind "Más detalles".
 */
export function IdeaBriefCard({
  ideaId,
  hook,
  visualBrief,
  captionAngle,
  hashtags,
  publishDate,
  deadline,
  hookSource,
  onBriefUpdated,
}: Props) {
  const [hookVal, setHookVal] = useState(hook ?? '')
  const [visualVal, setVisualVal] = useState(visualBrief ?? '')
  const [angleVal, setAngleVal] = useState(captionAngle ?? '')
  const [tagsVal, setTagsVal] = useState(hashtags ?? '')
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    setHookVal(hook ?? '')
    setVisualVal(visualBrief ?? '')
    setAngleVal(captionAngle ?? '')
    setTagsVal(hashtags ?? '')
  }, [ideaId, hook, visualBrief, captionAngle, hashtags])

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
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-purple-500" /> ¿De qué es este video?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Con esto la AI escribe el caption — igual que en el generador de ideas.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <InlineEdit
          type="textarea"
          label="¿De qué es este video?"
          value={hookVal}
          placeholder="Ej: tips para escoger el uniforme correcto para tu clínica…"
          onSave={(v) => saveBrief({ hook: v }, () => setHookVal(v))}
        />
        {hookSource === 'ai' && hookVal.trim() && (
          <p className="flex items-center gap-1 px-2 text-[11px] italic text-muted-foreground">
            <Sparkles className="h-3 w-3 shrink-0 text-purple-400" aria-hidden />
            Escrito por la IA a partir del video · edítalo si no cuadra
          </p>
        )}

        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Más detalles (opcional)
        </button>

        {detailsOpen && (
          <div className="space-y-3 border-t border-border/60 pt-3">
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
          </div>
        )}
      </CardContent>
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
