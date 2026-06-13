'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Send, Zap, CheckCircle2, CalendarClock, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { generateQuickCaption, sendQuickCaptionToMetricool } from '@/lib/actions/idea-lab-captions'

export interface QuickCaptionClient {
  id: string
  name: string
  metricool_blog_id: string | null
}

function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
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
  const [platform, setPlatform] = useState('instagram')
  const [topic, setTopic] = useState('')
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState(tomorrowISO())
  const [time, setTime] = useState('10:00')
  const [sentInfo, setSentInfo] = useState<string | null>(null)

  const [isGenerating, startGenerate] = useTransition()
  const [isSending, startSend] = useTransition()

  const selected = clients.find((c) => c.id === clientId)
  const hasMetricool = !!selected?.metricool_blog_id?.trim()

  function reset() {
    setClientId('')
    setContentType('P')
    setPlatform('instagram')
    setTopic('')
    setCaption('')
    setDate(tomorrowISO())
    setTime('10:00')
    setSentInfo(null)
  }

  function generate() {
    startGenerate(async () => {
      const res = await generateQuickCaption({ clientId, topic, platform })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaption(res.caption)
        toast({ title: 'Caption generado' })
      }
    })
  }

  function send() {
    startSend(async () => {
      const res = await sendQuickCaptionToMetricool({ clientId, caption, date, time, platform, contentType })
      if (res.error) toast({ title: 'No se pudo enviar', description: res.error, variant: 'destructive' })
      else {
        setSentInfo(formatScheduled(res.scheduledFor ?? null) ?? 'Programado')
        toast({ title: 'Enviado a Metricool', description: 'Quedó como borrador programado.' })
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
            Para emergencias e imprevistos: genera un caption y envíalo a Metricool sin pasar por una idea aprobada.
          </DialogDescription>
        </DialogHeader>

        {sentInfo ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span>Enviado a Metricool · {sentInfo} (borrador programado).</span>
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

            <div className="flex flex-wrap items-center gap-2">
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
                  disabled={isGenerating || !clientId || !topic.trim()}
                  className="transition-transform hover:scale-105"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {caption ? 'Regenerar' : 'Generar con IA'}
                </Button>
              )}
            </div>

            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={7}
              placeholder="Genera el caption con IA o escríbelo aquí…"
              className="resize-none text-sm leading-relaxed"
            />

            <div className="flex flex-wrap items-end gap-2 border-t pt-3">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Fecha
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40 text-xs" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Hora
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-8 w-28 text-xs" />
              </label>
              {canSend && (
                <Button
                  size="sm"
                  onClick={send}
                  disabled={isSending || !clientId || !caption.trim() || !hasMetricool}
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

            {clientId && !hasMetricool ? (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Este cliente no tiene Metricool configurado, no se puede programar.
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
