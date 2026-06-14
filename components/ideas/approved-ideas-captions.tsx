'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Save, Send, CheckCircle2, CalendarClock, AlertTriangle } from 'lucide-react'
import type { ApprovedIdea } from '@/lib/actions/idea-feedback-types'
import type { ContentIdeaType } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { defaultScheduleDate, scheduleMinDate } from '@/lib/utils/idea-lab-send-core'
import {
  generateApprovedIdeaCaption,
  saveApprovedIdeaCaption,
  sendApprovedIdeaToMetricool,
} from '@/lib/actions/idea-lab-captions'

const TYPE_LABEL: Record<ContentIdeaType, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

/** "2026-06-15T10:00:00" → "15 jun 2026, 10:00" for the sent badge. */
function formatScheduled(s: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ApprovedIdeasCaptions({ ideas }: { ideas: ApprovedIdea[] }) {
  if (ideas.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground">
        <CheckCircle2 className="mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Aún no hay ideas aprobadas.</p>
        <p className="text-xs">Cuando el equipo apruebe ideas en el Lab, podrás generar sus captions aquí.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {ideas.map((idea) => (
        <ApprovedIdeaCaptionCard key={idea.id} idea={idea} />
      ))}
    </div>
  )
}

function ApprovedIdeaCaptionCard({ idea }: { idea: ApprovedIdea }) {
  const canGenerate = useHasPermission('captions.use')
  const canSend = useHasPermission('posting.publish')
  const { toast } = useToast()

  const [caption, setCaption] = useState(idea.generated_caption ?? '')
  const [platform, setPlatform] = useState(idea.caption_platform ?? 'instagram')
  const [date, setDate] = useState(defaultScheduleDate())
  const [time, setTime] = useState('10:00')

  const [sentInfo, setSentInfo] = useState<string | null>(
    idea.metricool_post_id != null ? formatScheduled(idea.metricool_scheduled_for) : null,
  )
  const alreadySent = idea.metricool_post_id != null || sentInfo !== null

  const [isGenerating, startGenerate] = useTransition()
  const [isSaving, startSave] = useTransition()
  const [isSending, startSend] = useTransition()

  const hasMetricool = !!idea.client?.metricool_blog_id?.trim()
  const savedCaption = idea.generated_caption ?? ''
  const dirty = caption.trim() !== savedCaption.trim()
  const minDate = scheduleMinDate()
  const dateIsPast = !!date && date < minDate

  function generate() {
    startGenerate(async () => {
      const res = await generateApprovedIdeaCaption(idea.id, platform)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaption(res.caption)
        idea.generated_caption = res.caption // keep "dirty" accurate after generating
        toast({ title: 'Caption generado' })
      }
    })
  }

  function save() {
    startSave(async () => {
      const res = await saveApprovedIdeaCaption(idea.id, caption, platform)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        idea.generated_caption = caption
        toast({ title: 'Caption guardado' })
      }
    })
  }

  function send() {
    if (dirty) {
      toast({ title: 'Guarda el caption primero', description: 'Tienes cambios sin guardar.', variant: 'destructive' })
      return
    }
    startSend(async () => {
      const res = await sendApprovedIdeaToMetricool(idea.id, { date, time })
      if (res.error) toast({ title: 'No se pudo enviar', description: res.error, variant: 'destructive' })
      else {
        setSentInfo(formatScheduled(res.scheduledFor ?? null) ?? 'Programado')
        toast({ title: 'Enviado a Metricool', description: 'Quedó como borrador programado.' })
      }
    })
  }

  return (
    <div className="flex flex-col rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="min-w-0 truncate font-semibold">{idea.title}</h3>
        <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
          {TYPE_LABEL[idea.content_type] ?? idea.content_type}
        </Badge>
      </div>
      {idea.client?.name && <p className="mt-1 text-xs font-medium text-muted-foreground">{idea.client.name}</p>}
      {idea.hook && <p className="mt-2 text-sm font-medium">{idea.hook}</p>}
      {idea.caption_angle && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Ángulo:</span> {idea.caption_angle}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
        {canGenerate && (
          <Button
            size="sm"
            variant="outline"
            onClick={generate}
            disabled={isGenerating}
            className="transition-transform hover:scale-105"
          >
            {isGenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {caption ? 'Regenerar con IA' : 'Generar con IA'}
          </Button>
        )}
      </div>

      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={6}
        placeholder="Genera el caption con IA o escríbelo aquí…"
        className="mt-3 resize-none text-sm leading-relaxed"
      />

      {dirty && (
        <Button size="sm" variant="ghost" onClick={save} disabled={isSaving} className="mt-2 self-start">
          {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Guardar caption
        </Button>
      )}

      {/* Schedule + send */}
      <div className="mt-3 border-t pt-3">
        {alreadySent ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Enviado a Metricool{sentInfo ? ` · ${sentInfo}` : ''}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Fecha
                <Input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40 text-xs" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Hora
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-8 w-28 text-xs" />
              </label>
              {canSend && (
                <Button
                  size="sm"
                  onClick={send}
                  disabled={isSending || !caption.trim() || !hasMetricool || !date || dateIsPast}
                  className="transition-transform hover:scale-105"
                >
                  {isSending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Enviar a Metricool
                </Button>
              )}
            </div>
            {!hasMetricool && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Este cliente no tiene Metricool configurado, no se puede programar.
              </p>
            )}
            {hasMetricool && dateIsPast && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                La fecha ya pasó; elige hoy o una fecha futura.
              </p>
            )}
            {hasMetricool && !dateIsPast && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                Se crea como borrador programado — adjunta el diseño y aprueba dentro de Metricool.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
