'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import {
  Upload,
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  createEditorUploadIdea,
  pushEditorUploadDraft,
  reviseEditorUploadCaption,
  runEditorUploadPipeline,
  saveEditorUploadCaption,
  type EditorUploadClient,
  type EditorUploadStudioPayload,
} from '@/lib/actions/editor-upload'
import { registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'
import { isUploadAbortError, uploadEntregasFileFast } from '@/lib/utils/entregas-fast-upload'
import { assertPrimerRoundMp4, primerRoundUploadContentType } from '@/lib/primer-round/studio'
import { EDITOR_UPLOAD_MAX_BYTES, assertEditorUploadSize, formatEditorUploadBytes } from '@/lib/editor-upload/limits'
import { defaultIncludeCollabs } from '@/lib/editor-upload/collabs'
import type { PrimerRoundPieceKind } from '@/lib/editor-upload/piece-kind'

type PipelineStage =
  | 'idle'
  | 'creando'
  | 'subiendo'
  | 'analizando'
  | 'caption'
  | 'revision'
  | 'enviando'
  | 'listo'
  | 'error'

const STAGE_LABEL: Record<PipelineStage, string> = {
  idle: 'Listo para subir',
  creando: 'Creando pieza…',
  subiendo: 'Subiendo video…',
  analizando: 'IA leyendo el video…',
  caption: 'IA creando caption…',
  revision: 'Revisa el caption y envía el borrador',
  enviando: 'Creando borrador en Metricool…',
  listo: 'Borrador en Metricool',
  error: 'Error',
}

type KindChoice = 'auto' | PrimerRoundPieceKind

export function EditorUploadStudio({ studio }: { studio: EditorUploadStudioPayload }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const previewRef = useRef<string | null>(null)

  const [clientId, setClientId] = useState(studio.clients[0]?.id ?? '')
  const client = useMemo(
    () => studio.clients.find((c) => c.id === clientId) ?? null,
    [studio.clients, clientId],
  )
  const [kindChoice, setKindChoice] = useState<KindChoice>('auto')
  const [detectedKind, setDetectedKind] = useState<PrimerRoundPieceKind | null>(null)
  const [includeCollabs, setIncludeCollabs] = useState(() =>
    defaultIncludeCollabs(studio.clients[0]?.id ?? ''),
  )
  const [extraCollabs, setExtraCollabs] = useState('')

  const [stage, setStage] = useState<PipelineStage>('idle')
  const [pct, setPct] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [overlayText, setOverlayText] = useState<string | null>(null)
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [metricoolPostId, setMetricoolPostId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  function revokePreview() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
  }

  function resetToBlank() {
    cancelledRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    revokePreview()
    setStage('idle')
    setPct(0)
    setMessage(null)
    setCaption('')
    setOverlayText(null)
    setIdeaId(null)
    setVideoId(null)
    setFileLabel(null)
    setPreviewUrl(null)
    setFeedback('')
    setMetricoolPostId(null)
    setDetectedKind(null)
  }

  function onClientChange(id: string) {
    setClientId(id)
    setIncludeCollabs(defaultIncludeCollabs(id))
    setKindChoice('auto')
    setDetectedKind(null)
  }

  function stopUpload() {
    cancelledRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    resetToBlank()
    setStage('idle')
    setMessage(null)
  }

  async function runCaption(id: string, vid: string) {
    if (cancelledRef.current) return
    setStage('caption')
    setMessage('IA generando caption…')
    const res = await runEditorUploadPipeline({
      ideaId: id,
      videoId: vid,
      pieceKind: kindChoice,
    })
    if (cancelledRef.current) return
    if (res.caption) setCaption(res.caption)
    if (res.pieceKind) setDetectedKind(res.pieceKind)
    if (res.overlayText) setOverlayText(res.overlayText)
    if (res.error && !res.caption) {
      setStage('error')
      setMessage(res.error)
      return
    }
    setStage('revision')
    setMessage(res.error ?? 'Revisa el caption. Luego se envía como borrador a Metricool — no se publica solo.')
  }

  function onPickFile(file: File | null) {
    if (!file) return
    if (!clientId) {
      setStage('error')
      setMessage('Elige un cliente antes de subir.')
      return
    }
    const contentType = primerRoundUploadContentType({ fileName: file.name, contentType: file.type })
    const guard = assertPrimerRoundMp4({ fileName: file.name, contentType })
    if (guard) {
      setStage('error')
      setMessage(guard)
      return
    }
    const sizeErr = assertEditorUploadSize(file.size)
    if (sizeErr) {
      setStage('error')
      setMessage(sizeErr)
      return
    }

    cancelledRef.current = false
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    revokePreview()
    const url = URL.createObjectURL(file)
    previewRef.current = url
    setPreviewUrl(url)
    setFileLabel(file.name)
    setCaption('')
    setOverlayText(null)
    setFeedback('')
    setIdeaId(null)
    setVideoId(null)
    setMetricoolPostId(null)
    setDetectedKind(null)
    setMessage(null)
    setPct(0)

    startTransition(async () => {
      try {
        setStage('creando')
        const created = await createEditorUploadIdea({
          clientId,
          fileName: file.name,
          title: null,
          sizeBytes: file.size,
        })
        if (cancelledRef.current) return
        if (created.error || !created.ideaId) {
          setStage('error')
          setMessage(created.error ?? 'No se pudo crear la pieza')
          return
        }
        setIdeaId(created.ideaId)

        setStage('subiendo')
        const uploaded = await uploadEntregasFileFast({
          ideaId: created.ideaId,
          file,
          contentType,
          signal: abortRef.current?.signal,
          onProgress: setPct,
        })
        if (cancelledRef.current) return

        const reg = await registerEntregasVideo({
          ideaId: created.ideaId,
          key: uploaded.key,
          name: file.name,
          sizeBytes: file.size,
          mimeType: contentType,
        })
        if (cancelledRef.current) return
        if (reg.error || !reg.id) {
          setStage('error')
          setMessage(reg.error ?? 'No se pudo registrar el video')
          return
        }
        setVideoId(reg.id)

        setStage('analizando')
        setMessage('IA leyendo textos en pantalla y de qué va el video…')
        const processed = await processUploadedVideo(reg.id, file)
        if (cancelledRef.current) return
        if (!processed.analyzed) {
          setStage('error')
          setMessage(
            'El navegador no pudo leer este video para analizarlo. Prueba Safari o exporta a mp4 (H.264).',
          )
          return
        }

        await runCaption(created.ideaId, reg.id)
      } catch (err) {
        if (cancelledRef.current || isUploadAbortError(err)) return
        setStage('error')
        setMessage(err instanceof Error ? err.message : 'Error inesperado')
      }
    })
  }

  function applyFeedback() {
    if (!ideaId || !videoId || !feedback.trim()) return
    startTransition(async () => {
      setStage('caption')
      setMessage('IA aplicando tu feedback…')
      const res = await reviseEditorUploadCaption({
        ideaId,
        videoId,
        feedback: feedback.trim(),
        previousCaption: caption,
        pieceKind: detectedKind ?? (kindChoice === 'auto' ? null : kindChoice),
      })
      if (cancelledRef.current) return
      if (res.caption) setCaption(res.caption)
      if (res.pieceKind) setDetectedKind(res.pieceKind)
      if (res.error && !res.caption) {
        setStage('error')
        setMessage(res.error)
        return
      }
      setFeedback('')
      setStage('revision')
      setMessage(res.error ?? 'Caption actualizado. Revisa y envía el borrador.')
    })
  }

  function sendDraft() {
    if (!ideaId || !videoId || !caption.trim()) return
    startTransition(async () => {
      setStage('enviando')
      const saved = await saveEditorUploadCaption({
        ideaId,
        caption,
        pieceKind: detectedKind ?? (kindChoice === 'auto' ? null : kindChoice),
      })
      if (saved.error && !saved.caption) {
        setStage('error')
        setMessage(saved.error)
        return
      }
      const text = saved.caption ?? caption
      setCaption(text)
      const extras = extraCollabs
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const res = await pushEditorUploadDraft({
        ideaId,
        videoId,
        caption: text,
        includeCollabs,
        extraCollabUsernames: extras,
        pieceKind: detectedKind ?? (kindChoice === 'auto' ? null : kindChoice),
      })
      if (res.error) {
        setStage('error')
        setMessage(res.error)
        return
      }
      setMetricoolPostId(res.metricoolPostId ?? null)
      setStage('listo')
      setMessage(
        `Borrador creado en Metricool${res.metricoolPostId != null ? ` #${res.metricoolPostId}` : ''}. No está en vivo: hay que aceptarlo en Metricool.`,
      )
    })
  }

  const waiting = stage === 'idle' || stage === 'listo' || stage === 'error' || stage === 'revision'
  const busy = pending || !waiting
  const canStop =
    stage === 'creando' || stage === 'subiendo' || stage === 'analizando' || stage === 'caption'
  const noClients = studio.clients.length === 0
  const effectiveKind = detectedKind ?? (kindChoice === 'auto' ? null : kindChoice)

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-xl border bg-card p-4 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-40 blur-2xl"
          style={{ background: 'linear-gradient(135deg, #d4af37, transparent 70%)' }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Subir video</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Hasta {formatEditorUploadBytes(EDITOR_UPLOAD_MAX_BYTES)}. El archivo va directo a Entregas
              (no pasa por Vercel). La IA lee el video, arma el caption y tú lo mandas a Metricool como{' '}
              <strong className="font-medium text-foreground">borrador</strong> — nunca se publica solo.
            </p>
          </div>
          {client?.isPrimerRound && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" /> Collabs
              </Badge>
              {studio.primerRoundCollabs.map((c) => (
                <Badge key={c.username} variant="outline" className="font-mono text-[11px]">
                  @{c.username}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-4 sm:p-6" data-testid="editor-upload-panel">
        {noClients ? (
          <p className="text-sm text-muted-foreground" data-testid="editor-upload-empty-clients">
            No tienes clientes asignados. Pídele a un supervisor que te vincule en Asignaciones.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="editor-upload-client">Cliente</Label>
              <select
                id="editor-upload-client"
                data-testid="editor-upload-client"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={clientId}
                disabled={busy}
                onChange={(e) => onClientChange(e.target.value)}
              >
                {studio.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.blogId ? '' : ' (sin Metricool)'}
                  </option>
                ))}
              </select>
            </div>

            {client?.isPrimerRound && (
              <div className="space-y-1">
                <Label htmlFor="editor-upload-kind">Tipo de pieza (Primer Round)</Label>
                <select
                  id="editor-upload-kind"
                  data-testid="editor-upload-kind"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={kindChoice}
                  disabled={busy}
                  onChange={(e) => setKindChoice(e.target.value as KindChoice)}
                >
                  <option value="auto">Detectar (IA)</option>
                  <option value="live">Clip LIVE — «Hoy en Primer Round junto a…»</option>
                  <option value="gfx">GFX / promo — horario 5:43 AM + @hosts</option>
                </select>
                {effectiveKind && (
                  <p className="text-xs text-muted-foreground" data-testid="editor-upload-kind-detected">
                    Usando plantilla {effectiveKind === 'live' ? 'LIVE (nombres)' : 'GFX (@handles)'}.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid="editor-upload-collabs"
                  checked={includeCollabs}
                  disabled={busy}
                  onChange={(e) => setIncludeCollabs(e.target.checked)}
                />
                Colaboradores de Instagram en el borrador
              </label>
              {client?.isPrimerRound && includeCollabs && (
                <p className="text-xs text-muted-foreground">
                  Se taguean @{studio.primerRoundCollabs.map((c) => c.username).join(' y @')}.
                </p>
              )}
              {includeCollabs && !client?.isPrimerRound && (
                <input
                  data-testid="editor-upload-extra-collabs"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  placeholder="@usuario1, @usuario2"
                  value={extraCollabs}
                  disabled={busy}
                  onChange={(e) => setExtraCollabs(e.target.value)}
                />
              )}
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-sm font-semibold">Archivo</h2>
              <p className="text-xs text-muted-foreground">
                mp4 o mov, máx. {formatEditorUploadBytes(studio.maxBytes)}. Directo a Entregas.
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              className="sr-only"
              data-testid="editor-upload-input"
              disabled={busy || noClients}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                e.target.value = ''
                onPickFile(f)
              }}
            />

            <Button
              size="lg"
              className="w-full gap-2"
              disabled={busy || noClients}
              data-testid="editor-upload-cta"
              onClick={() => {
                if (stage !== 'idle') resetToBlank()
                inputRef.current?.click()
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload video
            </Button>

            {canStop && (
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2"
                data-testid="editor-upload-stop-cta"
                onClick={stopUpload}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Detener
              </Button>
            )}

            {previewUrl && (
              <video
                data-testid="editor-upload-video-preview"
                src={previewUrl}
                controls
                playsInline
                className="mx-auto max-h-80 w-full rounded-lg bg-black"
              />
            )}

            {(stage !== 'idle' || message) && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3" data-testid="editor-upload-status">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{STAGE_LABEL[stage]}</span>
                  {fileLabel && <span className="truncate text-muted-foreground">{fileLabel}</span>}
                </div>
                {stage === 'subiendo' && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {message && (
                  <p
                    className={cn(
                      'text-xs',
                      stage === 'error' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {stage === 'error' && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                    {stage === 'listo' && <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-500" />}
                    {message}
                  </p>
                )}
              </div>
            )}

            {(stage === 'revision' || stage === 'listo' || caption) && caption && (
              <div className="space-y-2" data-testid="editor-upload-caption-panel">
                <Label htmlFor="editor-upload-caption">Caption</Label>
                <Textarea
                  id="editor-upload-caption"
                  data-testid="editor-upload-caption"
                  value={caption}
                  disabled={busy && stage !== 'revision'}
                  rows={8}
                  onChange={(e) => setCaption(e.target.value)}
                />
                {overlayText && (
                  <p className="whitespace-pre-wrap text-[11px] text-muted-foreground" data-testid="editor-upload-overlay">
                    Overlay: {overlayText}
                  </p>
                )}
                <Textarea
                  data-testid="editor-upload-feedback"
                  placeholder="Feedback para la IA (opcional)"
                  value={feedback}
                  disabled={busy}
                  rows={2}
                  onChange={(e) => setFeedback(e.target.value)}
                />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={busy || !feedback.trim()}
                  data-testid="editor-upload-feedback-cta"
                  onClick={applyFeedback}
                >
                  <Sparkles className="h-4 w-4" />
                  Reescribir caption
                </Button>
                <Button
                  size="lg"
                  className="w-full gap-2"
                  disabled={busy || !caption.trim() || stage === 'listo'}
                  data-testid="editor-upload-draft-cta"
                  onClick={sendDraft}
                >
                  <Send className="h-4 w-4" />
                  Enviar borrador a Metricool
                </Button>
                {metricoolPostId != null && (
                  <p className="text-center text-xs text-muted-foreground" data-testid="editor-upload-draft-id">
                    Metricool #{metricoolPostId}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
