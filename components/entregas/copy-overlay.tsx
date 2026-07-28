'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Sparkles, Save, Send, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/hooks/use-toast'
import { generateIdeaCaption, saveIdeaCaption } from '@/lib/actions/idea-captions'
import {
  getEntregaCopyVideos,
  updateIdeaHook,
  saveClientCaptionNotes,
  type CopyVideoRow,
} from '@/lib/actions/entregas-copy'

/**
 * The Copy stage, one video at a time.
 *
 * Writing the caption is what moves the video on: ideaStage() sends an approved
 * video with a non-empty generated_caption to Publicación. So "enviar a
 * Publicación" is literally "save the copy" — there's no separate state to set,
 * and pretending otherwise would let the two disagree.
 */
export function CopyOverlay({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string
  clientName: string
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [videos, setVideos] = useState<CopyVideoRow[] | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [hook, setHook] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState<'generando' | 'guardando' | null>(null)

  const load = useCallback(async () => {
    const res = await getEntregaCopyVideos(clientId)
    if (res.error) return setError(res.error)
    const pending = (res.data?.videos ?? []).filter((v) => !v.generated_caption?.trim())
    setVideos(pending)
    setNotes(res.data?.captionNotes ?? '')
    setIndex(0)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  const current = videos?.[index] ?? null

  // Reset the per-video fields whenever a different video comes on screen.
  useEffect(() => {
    setHook(current?.hook ?? '')
    setCaption(current?.generated_caption ?? '')
  }, [current?.id, current?.hook, current?.generated_caption])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function generate() {
    if (!current) return
    if (!hook.trim()) {
      toast({ title: 'Falta "de qué es el video"', description: 'La IA lo necesita para escribir.', variant: 'destructive' })
      return
    }
    setBusy('generando')
    try {
      // Persist the hook and the client rules FIRST — the prompt reads them
      // from the database, not from this form.
      await updateIdeaHook(current.id, hook)
      await saveClientCaptionNotes(clientId, notes)
      const res = await generateIdeaCaption(current.id)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) setCaption(res.caption)
    } finally {
      setBusy(null)
    }
  }

  async function sendToPublication() {
    if (!current || !caption.trim()) return
    setBusy('guardando')
    try {
      const res = await saveIdeaCaption(current.id, caption.trim())
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Copy guardado — pasa a Publicación' })
      await load()
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const done = videos !== null && videos.length === 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-card px-5 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight">Copy — {clientName}</h2>
          <p className="truncate text-xs text-muted-foreground">
            Escribe el copy y envíalo a Publicación.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar copy"
          className="shrink-0 rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 p-5">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {!videos && !error && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Cargando…
          </div>
        )}

        {done && (
          <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-10 text-center">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <p className="text-sm font-medium">No queda copy por escribir</p>
          </div>
        )}

        {current && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="text-[11px] tabular-nums text-muted-foreground">
                Video {index + 1} de {videos!.length}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>‹</Button>
                <Button size="sm" variant="ghost" disabled={index >= videos!.length - 1} onClick={() => setIndex((i) => i + 1)}>›</Button>
              </div>
            </div>

            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h3 className="truncate text-sm font-semibold">{current.title}</h3>

              <div className="space-y-1.5">
                <Label htmlFor="co-hook" className="text-[11px]">¿De qué es el video? *</Label>
                <Input
                  id="co-hook"
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  placeholder="p. ej. Un socio cuenta cómo bajó 15 lb en 3 meses"
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Es lo único que la IA necesita para escribir el copy.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="co-notes" className="text-[11px]">
                  Texto fijo del cliente (horario, dirección…)
                </Label>
                <textarea
                  id="co-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Se incluye en TODOS los copies de este cliente."
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se guarda en el cliente, no en este video — vale para todos sus copies.
                </p>
              </div>

              <Button size="sm" variant="outline" disabled={busy !== null} onClick={generate}>
                {busy === 'generando'
                  ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                  : <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                {caption.trim() ? 'Regenerar con IA' : 'Generar copy con IA'}
              </Button>
            </section>

            <section className="space-y-2 rounded-xl border bg-card p-4">
              <Label htmlFor="co-caption" className="text-[11px]">Copy final</Label>
              <textarea
                id="co-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={9}
                placeholder="Genera con IA o escríbelo a mano. Puedes editar lo que genere."
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {caption.trim().length} caracteres
                </span>
                <Button size="sm" disabled={busy !== null || !caption.trim()} onClick={sendToPublication}>
                  {busy === 'guardando'
                    ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                    : <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                  Enviar a Publicación
                </Button>
              </div>
              {!caption.trim() && (
                <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Guardar el copy es lo que mueve el video a Publicación.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
