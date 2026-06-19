'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Send, Zap, CheckCircle2, CalendarClock, AlertTriangle, Upload, Film, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { defaultScheduleDate, scheduleMinDate, nowMinuteInPostTZ } from '@/lib/utils/idea-lab-send-core'
import { generateQuickCaption, sendQuickCaptionToMetricool } from '@/lib/actions/idea-lab-captions'
import { getQuickUploadUrl } from '@/lib/actions/idea-videos-r2'

export interface QuickCaptionClient {
  id: string
  name: string
  metricool_blog_id: string | null
}

function formatScheduled(s: string | null): string | null {
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/**
 * Standalone "emergency" caption creator: generate a caption from scratch for a
 * client and send it to Metricool as a scheduled draft — no approved idea
 * required. Lives behind a button in the Captions tab.
 */
export function QuickCaptionDialog({ clients }: { clients: QuickCaptionClient[] }) {
  const canGenerate = useHasPermission('captions.use')
  const canSend = useHasPermission('posting.publish')
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [contentType, setContentType] = useState('P')
  const [topic, setTopic] = useState('')
  const [caption, setCaption] = useState('')
  const [video, setVideo] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'draft' | 'autopublish'>('draft')
  const [date, setDate] = useState(defaultScheduleDate())
  const [time, setTime] = useState('10:00')
  const [sentInfo, setSentInfo] = useState<string | null>(null)
  const [autoPublished, setAutoPublished] = useState(false)

  const [isGenerating, startGenerate] = useTransition()
  const [isSending, startSend] = useTransition()

  const selected = clients.find((c) => c.id === clientId)
  const hasMetricool = !!selected?.metricool_blog_id?.trim()
  const minDate = scheduleMinDate()
  const dateIsPast = !!date && date < minDate
  // Auto-publish can't be in the past (Metricool would publish at once / error).
  // Same-day-but-earlier-time only matters for auto-publish; drafts are exempt.
  const timeIsPast =
    mode === 'autopublish' && !dateIsPast && !!date && !!time && `${date}T${time}` < nowMinuteInPostTZ()

  function reset() {
    setClientId('')
    setContentType('P')
    setTopic('')
    setCaption('')
    setVideo(null)
    setUploading(false)
    setMode('draft')
    setDate(defaultScheduleDate())
    setTime('10:00')
    setSentInfo(null)
    setAutoPublished(false)
  }

  function generate() {
    startGenerate(async () => {
      const res = await generateQuickCaption({ clientId, topic })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaption(res.caption)
        toast({ title: 'Caption generado' })
      }
    })
  }

  function send() {
    startSend(async () => {
      // With a video: upload it straight to R2 first, then send its public URL to
      // Metricool so it attaches the media and auto-publishes.
      let mediaUrl: string | null = null
      if (video) {
        setUploading(true)
        const up = await getQuickUploadUrl({ clientId, fileName: video.name, contentType: video.type || 'video/mp4' })
        if (up.error || !up.url || !up.publicUrl) {
          setUploading(false)
          toast({ title: 'No se pudo subir el video', description: up.error ?? 'Error de subida', variant: 'destructive' })
          return
        }
        try {
          const put = await fetch(up.url, { method: 'PUT', body: video, headers: { 'Content-Type': video.type || 'video/mp4' } })
          if (!put.ok) throw new Error(`Subida falló (HTTP ${put.status})`)
        } catch (err) {
          setUploading(false)
          toast({ title: 'No se pudo subir el video', description: err instanceof Error ? err.message : 'Error de subida', variant: 'destructive' })
          return
        }
        mediaUrl = up.publicUrl
        setUploading(false)
      }

      const res = await sendQuickCaptionToMetricool({ clientId, caption, date, time, contentType, mediaUrl, autoPublish: mode === 'autopublish' })
      if (res.error) {
        toast({ title: 'No se pudo enviar', description: res.error, variant: 'destructive' })
      } else {
        setSentInfo(formatScheduled(res.scheduledFor ?? null) ?? 'Programado')
        setAutoPublished(!!res.autoPublished)
        toast({
          title: res.autoPublished ? 'Enviado a Metricool — se publicará solo' : 'Enviado a Metricool',
          description: res.autoPublished ? 'El video se publicará automáticamente en la fecha elegida.' : 'Quedó como borrador programado.',
        })
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="transition-transform hover:scale-105">
          <Zap className="mr-1.5 h-3.5 w-3.5" />
          Caption rápido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Caption rápido</DialogTitle>
          <DialogDescription>
            Para emergencias e imprevistos: sube un video, genera un caption y publícalo en Metricool — el mismo caption
            va a todas las redes del cliente, sin pasar por una idea aprobada.
          </DialogDescription>
        </DialogHeader>

        {sentInfo ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span>Enviado a Metricool · {sentInfo}{autoPublished ? ' — se publicará automáticamente.' : ' (borrador programado).'}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Crear otro
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Cliente
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Elige cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {!c.metricool_blog_id?.trim() ? ' (sin Metricool)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Formato
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R">Reel</SelectItem>
                    <SelectItem value="P">Post</SelectItem>
                    <SelectItem value="C">Carrusel</SelectItem>
                    <SelectItem value="S">Story</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              ¿De qué trata? (para la IA)
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={2}
                placeholder="Ej: promo de último minuto 2x1 este fin de semana…"
                className="resize-none text-sm"
              />
            </label>

            {canGenerate && (
              <Button
                size="sm"
                variant="outline"
                onClick={generate}
                disabled={isGenerating || !clientId || !topic.trim()}
                className="self-start transition-transform hover:scale-105"
              >
                {isGenerating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {caption ? 'Regenerar' : 'Generar con IA'}
              </Button>
            )}

            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={7}
              placeholder="Genera el caption con IA o escríbelo aquí…"
              className="resize-none text-sm leading-relaxed"
            />

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Video (opcional — se publica a todas las redes)</span>
              {video ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{video.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setVideo(null)}
                    aria-label="Quitar video"
                    className="shrink-0 text-muted-foreground transition hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground">
                  <Upload className="h-4 w-4 shrink-0" />
                  Subir video
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Al programar</span>
              <div className="inline-flex w-fit rounded-md border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('draft')}
                  className={cn('rounded px-3 py-1.5 transition', mode === 'draft' ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  Borrador
                </button>
                <button
                  type="button"
                  onClick={() => setMode('autopublish')}
                  className={cn('rounded px-3 py-1.5 transition', mode === 'autopublish' ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  Publicar automáticamente
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t pt-3">
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
                  disabled={isSending || !clientId || !caption.trim() || !hasMetricool || !date || dateIsPast || timeIsPast}
                  className="transition-transform hover:scale-105"
                >
                  {isSending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {uploading ? 'Subiendo video…' : mode === 'autopublish' ? 'Publicar en Metricool' : 'Enviar a Metricool'}
                </Button>
              )}
            </div>

            {clientId && !hasMetricool ? (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Este cliente no tiene Metricool configurado, no se puede programar.
              </p>
            ) : dateIsPast ? (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                La fecha ya pasó; elige hoy o una fecha futura.
              </p>
            ) : timeIsPast ? (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                La hora ya pasó; elige una fecha y hora futuras para autopublicar.
              </p>
            ) : mode === 'autopublish' ? (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                Se publicará automáticamente a las redes del cliente en la fecha y hora elegidas{video ? ' (con el video adjunto)' : ''}.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                Se crea como borrador programado — adjunta el diseño y aprueba dentro de Metricool.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
