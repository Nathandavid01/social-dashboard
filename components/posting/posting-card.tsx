'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Play,
  ExternalLink,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { sendDraftToMetricool } from '@/lib/actions/posting'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import { ExternalLink as ExternalLinkIcon } from 'lucide-react'
import type { PostingQueueItem } from '@/lib/actions/posting'
import type { PostingDraft as PostingDraftType } from '@/lib/supabase/types'

interface PostingCardProps {
  item: PostingQueueItem
  onSent?: (draft: PostingDraftType) => void
  readonly?: boolean
}

function defaultScheduledFor(): string {
  // Tomorrow at 10:00 local time
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PostingCard({ item, onSent, readonly = false }: PostingCardProps) {
  const { toast } = useToast()
  const { review, client, draft } = item
  const [caption, setCaption] = useState(draft?.caption ?? '')
  const [scheduledFor, setScheduledFor] = useState(
    draft?.scheduled_for
      ? format(parseISO(draft.scheduled_for), "yyyy-MM-dd'T'HH:mm")
      : defaultScheduledFor()
  )
  const [generating, setGenerating] = useState(false)
  const [isPending, startTransition] = useTransition()

  const platforms = client?.default_platforms ?? ['instagram', 'facebook']
  const hasMetricool = !!client?.metricool_blog_id

  async function generateCaption() {
    if (!client) {
      toast({ title: 'Falta cliente', description: 'Asigna un cliente al video primero', variant: 'destructive' })
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle: review.title,
          platform: platforms[0] ?? 'Instagram',
          clientId: client.id,
          videoReviewId: review.id,
          clientName: client.name,
          metricoolBlogId: client.metricool_blog_id,
          brandVoice: client.brand_voice,
          captionLanguage: client.caption_language,
          defaultCta: client.default_cta,
          defaultHashtags: client.default_hashtags,
          captionNotes: client.caption_notes,
          industry: client.industry,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to generate')
      setCaption(json.caption)
      toast({ title: 'Caption generada', description: `${json.examplesUsed ?? 0} ejemplos usados` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast({ title: 'Error al generar', description: msg, variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  function send() {
    if (!caption.trim()) {
      toast({ title: 'Caption vacía', description: 'Genera o escribe una caption primero', variant: 'destructive' })
      return
    }
    if (!hasMetricool) {
      toast({ title: 'Falta Metricool', description: 'Este cliente no tiene blog de Metricool configurado', variant: 'destructive' })
      return
    }
    startTransition(async () => {
      const result = await sendDraftToMetricool({
        videoReviewId: review.id,
        clientId: client?.id ?? null,
        scheduledFor: new Date(scheduledFor).toISOString(),
        caption: caption.trim(),
        platforms,
      })
      if (result.error) {
        toast({ title: 'Error al enviar', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Borrador creado en Metricool', description: format(new Date(scheduledFor), 'PPP p') })
      if (onSent && result.success) {
        // Construct a minimal draft for optimistic UI; real fetch on next reload
        onSent({
          id: 'optimistic-' + review.id,
          video_review_id: review.id,
          client_id: client?.id ?? null,
          scheduled_for: new Date(scheduledFor).toISOString(),
          caption: caption.trim(),
          platforms,
          metricool_post_id: result.metricoolPostId ?? null,
          metricool_uuid: result.metricoolUuid ?? null,
          status: 'sent',
          error_message: null,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    })
  }

  const isSent = draft?.status === 'sent'
  const isFailed = draft?.status === 'failed'

  return (
    <Card className={isSent ? 'border-green-500/30 bg-green-500/5' : isFailed ? 'border-red-500/30 bg-red-500/5' : ''}>
      <CardHeader className="pb-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-snug truncate">{review.title}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {client?.name ? <span className="font-medium text-foreground">@ {client.name}</span> : <span className="text-red-500">Sin cliente</span>}
              {!hasMetricool && <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-700">Sin Metricool</Badge>}
              {isSent && <Badge className="text-[10px] bg-green-600">Enviado</Badge>}
              {isFailed && <Badge variant="destructive" className="text-[10px]">Falló</Badge>}
            </div>
          </div>
          <a
            href={review.drive_link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Ver en Drive"
          >
            <Play className="h-3.5 w-3.5" />
          </a>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Platforms summary */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {platforms.map((p) => (
            <Badge key={p} variant="secondary" className="text-[10px] capitalize">{p}</Badge>
          ))}
        </div>

        {/* Schedule date */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Fecha programada
          </Label>
          <Input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            disabled={readonly || isPending}
            className="h-8 text-xs"
          />
        </div>

        {/* Caption */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Caption</Label>
            {!readonly && (
              <Button
                size="sm"
                variant="ghost"
                onClick={generateCaption}
                disabled={generating || !client}
                className="h-6 px-2 text-xs"
              >
                {generating ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                {generating ? 'Generando...' : 'Generar con IA'}
              </Button>
            )}
          </div>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Genera con IA o escribe la caption aquí..."
            rows={6}
            disabled={readonly || isPending}
            className="text-xs resize-none"
          />
        </div>

        {/* Send button */}
        {!readonly && (
          <>
            <Button
              onClick={send}
              disabled={isPending || !caption.trim() || !hasMetricool}
              className="w-full gap-2"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {isPending ? 'Enviando...' : 'Enviar a Metricool'}
            </Button>

            {!hasMetricool && client && (
              <Link
                href={`/clients/${client.id}`}
                className="flex items-center justify-center gap-1 text-xs text-yellow-700 hover:text-yellow-800 hover:underline"
              >
                <AlertCircle className="h-3 w-3" />
                Configura Metricool en este cliente
                <ExternalLinkIcon className="h-3 w-3" />
              </Link>
            )}
            {!hasMetricool && !client && (
              <p className="text-center text-xs text-red-600 flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Asigna un cliente al video primero
              </p>
            )}
            {hasMetricool && !caption.trim() && (
              <p className="text-center text-xs text-muted-foreground">
                Genera una caption para habilitar el envío
              </p>
            )}
          </>
        )}

        {isFailed && draft?.error_message && (
          <p className="text-xs text-red-600 flex items-start gap-1">
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
            {draft.error_message}
          </p>
        )}
        {isSent && (
          <p className="text-xs text-green-700 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Programado en Metricool
            {draft?.metricool_post_id && <span className="text-muted-foreground">#{draft.metricool_post_id}</span>}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
