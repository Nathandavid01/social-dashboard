'use client'

import { useRef, useState, useTransition } from 'react'
import {
  Upload,
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  ShieldCheck,
  Square,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientLogo } from '@/components/clients/client-logo'
import { cn } from '@/lib/utils'
import {
  createPrimerRoundUploadIdea,
  pushPrimerRoundDraft,
  revisePrimerRoundCaption,
  runPrimerRoundUploadPipeline,
  type PrimerRoundStudioPayload,
} from '@/lib/actions/primer-round'
import { registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'
import { isUploadAbortError, uploadEntregasFileFast } from '@/lib/utils/entregas-fast-upload'
import type { PrimerRoundOrthoGate } from '@/lib/primer-round/orthography'
import { assertPrimerRoundMp4, primerRoundUploadContentType } from '@/lib/primer-round/studio'
import { PRIMER_ROUND_CAPTION_HOSTS } from '@/lib/primer-round/caption-template'
import { primerRoundNextAirCopy, PRIMER_ROUND_AIR_CLOCK } from '@/lib/primer-round/air-time'
import { normalizePrimerRoundCaption } from '@/lib/primer-round/caption-template'
import {
  PRIMER_ROUND_UPLOAD_MAX_BYTES,
  assertPrimerRoundUploadSize,
  formatPrimerRoundUploadBytes,
} from '@/lib/primer-round/upload-limits'
import type { PrimerRoundPieceKind } from '@/lib/primer-round/piece-kind'
import {
  clearPrimerRoundLivePreview,
  getPrimerRoundLivePreview,
  livePreviewKey,
  setPrimerRoundLivePreview,
} from '@/lib/primer-round/live-preview'
type PipelineStage =
  | 'idle'
  | 'creando'
  | 'subiendo'
  | 'analizando'
  | 'caption'
  | 'verificando'
  | 'revision'
  | 'enviando'
  | 'listo'
  | 'bloqueado'
  | 'error'

type KindChoice = 'auto' | PrimerRoundPieceKind

const STAGE_LABEL: Record<PipelineStage, string> = {
  idle: 'Listo para subir',
  creando: 'Creando pieza…',
  subiendo: 'Subiendo video…',
  analizando: 'IA leyendo overlay…',
  caption: 'IA creando caption IG…',
  verificando: 'IA verificando ortografía…',
  revision: 'Pendiente de tu OK',
  enviando: 'Creando borrador en Metricool…',
  listo: 'Borrador en Metricool',
  bloqueado: 'Verificación pendiente',
  error: 'Error',
}

export function PrimerRoundStudio({ studio }: { studio: PrimerRoundStudioPayload }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasPickedFile = useRef(false)
  const cancelledRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [pct, setPct] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [gate, setGate] = useState<PrimerRoundOrthoGate | null>(null)
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [overrideOrtho, setOverrideOrtho] = useState(false)
  const [fileLabel, setFileLabel] = useState<string | null>(() => getPrimerRoundLivePreview()?.file.name ?? null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => getPrimerRoundLivePreview()?.url ?? null)
  const [previewKey, setPreviewKey] = useState(() => livePreviewKey(getPrimerRoundLivePreview()))
  const [overlayText, setOverlayText] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [styleRules, setStyleRules] = useState<string[]>(studio.styleRules ?? [])
  const [kindChoice, setKindChoice] = useState<KindChoice>('auto')
  const [detectedKind, setDetectedKind] = useState<PrimerRoundPieceKind | null>(null)
  const [metricoolPostId, setMetricoolPostId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const maxBytes = studio.maxBytes ?? PRIMER_ROUND_UPLOAD_MAX_BYTES
  const canDraft = studio.canDraft !== false
  const effectiveKind = detectedKind ?? (kindChoice === 'auto' ? null : kindChoice)

  function resetToBlank() {
    hasPickedFile.current = true
    cancelledRef.current = true
    clearPrimerRoundLivePreview()
    setStage('idle')
    setPct(0)
    setMessage(null)
    setCaption(null)
    setGate(null)
    setIdeaId(null)
    setVideoId(null)
    setOverrideOrtho(false)
    setFileLabel(null)
    setOverlayText(null)
    setFeedback('')
    setPreviewUrl(null)
    setPreviewKey('empty')
    setDetectedKind(null)
    setMetricoolPostId(null)
  }

  function showPickedFile(file: File) {
    const live = setPrimerRoundLivePreview(file)
    setPreviewUrl(live.url)
    setPreviewKey(livePreviewKey(live))
    setFileLabel(file.name)
  }

  function stopUpload() {
    cancelledRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    resetToBlank()
    setStage('idle')
    setMessage(null)
  }

  async function runPipeline(id: string, vid: string | null) {
    if (cancelledRef.current) return
    if (!vid) {
      setStage('error')
      setMessage('Falta el video de esta subida. No se usa otro archivo.')
      return
    }
    setStage('caption')
    setMessage('IA generando caption (plantilla @primerroundoficial)…')
    const res = await runPrimerRoundUploadPipeline({
      ideaId: id,
      videoId: vid,
      pieceKind: kindChoice,
    })
    if (cancelledRef.current) return
    if (res.pieceKind) setDetectedKind(res.pieceKind)
    if (res.caption) {
      setCaption(normalizePrimerRoundCaption(res.caption, undefined, res.pieceKind ?? 'gfx'))
    }
    if (res.gate) {
      setGate(res.gate)
      if (res.gate.overlay.text) setOverlayText(res.gate.overlay.text)
    }

    if (res.error && !res.pending) {
      setStage('error')
      setMessage(res.error)
      return
    }
    setStage('revision')
    setMessage(res.error ?? 'Revisa el caption. Luego se envía como borrador a Metricool — no se publica solo.')
  }

  function onPickFile(file: File | null) {
    if (!file) return
    const contentType = primerRoundUploadContentType({ fileName: file.name, contentType: file.type })
    const guard = assertPrimerRoundMp4({ fileName: file.name, contentType })
    if (guard) {
      setStage('error')
      setMessage(guard)
      return
    }
    const sizeErr = assertPrimerRoundUploadSize(file.size)
    if (sizeErr) {
      setStage('error')
      setMessage(sizeErr)
      return
    }

    hasPickedFile.current = true
    cancelledRef.current = false
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    showPickedFile(file)
    setCaption(null)
    setGate(null)
    setOverlayText(null)
    setFeedback('')
    setOverrideOrtho(false)
    setMessage(null)
    setIdeaId(null)
    setVideoId(null)
    setMetricoolPostId(null)
    setDetectedKind(null)
    setPct(0)

    startTransition(async () => {
      try {
        setStage('creando')
        const created = await createPrimerRoundUploadIdea({
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
            'El navegador no pudo leer este video para analizarlo. Prueba Safari o exporta a mp4 (H.264). No se agenda a ciegas.',
          )
          return
        }

        setStage('verificando')
        await runPipeline(created.ideaId, reg.id)
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
      const res = await revisePrimerRoundCaption({
        ideaId,
        videoId,
        feedback: feedback.trim(),
        previousCaption: caption,
        pieceKind: detectedKind ?? (kindChoice === 'auto' ? null : kindChoice),
      })
      if (cancelledRef.current) return
      if (res.pieceKind) setDetectedKind(res.pieceKind)
      if (res.caption) {
        setCaption(normalizePrimerRoundCaption(res.caption, undefined, res.pieceKind ?? 'gfx'))
      }
      if (res.gate) {
        setGate(res.gate)
        if (res.gate.overlay.text) setOverlayText(res.gate.overlay.text)
      }
      if (res.styleRules) setStyleRules(res.styleRules)
      if (res.error && !res.caption) {
        setStage('error')
        setMessage(res.error)
        return
      }
      setFeedback('')
      setStage('revision')
      setMessage(res.error ?? 'Estilo guardado para los Reels de Primer Round. Revisa y envía el borrador.')
    })
  }

  function sendDraft() {
    if (!ideaId || !videoId || !caption?.trim()) return
    startTransition(async () => {
      setStage('enviando')
      const res = await pushPrimerRoundDraft({
        ideaId,
        videoId,
        caption,
        pieceKind: detectedKind ?? (kindChoice === 'auto' ? 'gfx' : kindChoice),
      })
      if (res.caption) {
        setCaption(normalizePrimerRoundCaption(res.caption, undefined, detectedKind ?? 'gfx'))
      }
      if (res.error) {
        setStage('error')
        setMessage(res.error)
        return
      }
      setMetricoolPostId(res.metricoolPostId ?? null)
      setStage('listo')
      setMessage(
        `Borrador creado en Metricool${
          res.metricoolPostId != null ? ` #${res.metricoolPostId}` : ''
        }. No está en vivo: hay que aceptarlo en Metricool.`,
      )
    })
  }

  const waiting = stage === 'idle' || stage === 'listo' || stage === 'bloqueado' || stage === 'error' || stage === 'revision'
  const busy = pending || !waiting
  const canStop =
    stage === 'creando' ||
    stage === 'subiendo' ||
    stage === 'analizando' ||
    stage === 'caption' ||
    stage === 'verificando'

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-xl border bg-card p-4 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-40 blur-2xl"
          style={{ background: 'linear-gradient(135deg, #f59e0b, transparent 70%)' }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ClientLogo name={studio.client.name} logoUrl={studio.client.logoUrl} className="h-10 w-10 text-[11px]" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Primer Round</h1>
              <p className="truncate text-xs text-muted-foreground">
                @{studio.client.igHandle} · blog {studio.client.blogId}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" /> Collabs
            </Badge>
            {studio.collabs.map((c) => (
              <Badge key={c.username} variant="outline" className="font-mono text-[11px]">
                @{c.username}
              </Badge>
            ))}
          </div>
        </div>
        <p className="relative mt-3 text-xs text-muted-foreground">
          Sube el mp4 o mov (máx. {formatPrimerRoundUploadBytes(maxBytes)}): ves la película, la IA
          lee los textos y arma el caption (hosts {PRIMER_ROUND_CAPTION_HOSTS}). Luego se envía a
          Metricool como <strong className="font-medium text-foreground">borrador</strong> con collabs
          IG — nunca se publica solo. Al aire lun–vie {PRIMER_ROUND_AIR_CLOCK}. Si sales hoy:{' '}
          {primerRoundNextAirCopy().phraseStart ?? primerRoundNextAirCopy().phrase}.
        </p>
      </header>

      <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-4 sm:p-6" data-testid="primer-round-upload-panel">
        <div className="text-center space-y-1">
          <h2 className="text-sm font-semibold">Subir video</h2>
          <p className="text-xs text-muted-foreground">
            mp4 o mov, máx. {formatPrimerRoundUploadBytes(maxBytes)}. Va directo a Entregas (no pasa
            por Vercel). Revisa el caption y envía el borrador a Metricool.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo de pieza
          </span>
          <select
            id="primer-round-kind"
            data-testid="primer-round-kind"
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
            <p className="text-xs text-muted-foreground" data-testid="primer-round-kind-detected">
              Usando plantilla {effectiveKind === 'live' ? 'LIVE (nombres)' : 'GFX (@handles)'}.
            </p>
          )}
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="sr-only"
          data-testid="primer-round-upload-input"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            e.target.value = ''
            onPickFile(f)
          }}
        />

        <Button
          size="lg"
          className="w-full gap-2"
          disabled={busy}
          data-testid="primer-round-upload-cta"
          onClick={() => {
            resetToBlank()
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
            data-testid="primer-round-stop-cta"
            onClick={stopUpload}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Detener
          </Button>
        )}

        {previewUrl && (
          <video
            key={previewKey}
            data-testid="primer-round-video-preview"
            src={previewUrl}
            controls
            playsInline
            className="aspect-[9/16] w-full max-h-[28rem] rounded-lg bg-black object-contain"
          />
        )}

        {(stage !== 'idle' || fileLabel) && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3" data-testid="primer-round-pipeline-status">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium">{STAGE_LABEL[stage]}</span>
              {fileLabel && <span className="truncate text-muted-foreground">{fileLabel}</span>}
            </div>
            {stage === 'subiendo' && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            {caption && (
              <div className="space-y-1" data-testid="primer-round-caption-panel">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3" /> Caption IG
                </p>
                <pre className="whitespace-pre-wrap text-xs leading-relaxed">{caption}</pre>
              </div>
            )}
            {!gate && overlayText && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Texto overlay (en pantalla)
                </p>
                <pre
                  data-testid="primer-round-overlay-text"
                  className="whitespace-pre-wrap rounded-md border bg-background/60 p-2 text-xs leading-relaxed"
                >
                  {overlayText}
                </pre>
              </div>
            )}
            {gate && (
              <div className="space-y-2" data-testid="primer-round-ortho-panel">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> Verificación
                </p>
                <OrthoRow
                  ok={gate.overlay.ok && !gate.overlay.missing}
                  label="Texto overlay (en pantalla)"
                  detail={
                    gate.overlay.missing
                      ? 'Sin texto overlay / análisis'
                      : gate.overlay.ok
                        ? 'Sin errores'
                        : `${gate.overlay.issues.length} a corregir`
                  }
                />
                {(gate.overlay.text || overlayText) && (
                  <pre
                    data-testid="primer-round-overlay-text"
                    className="whitespace-pre-wrap rounded-md border bg-background/60 p-2 text-xs leading-relaxed"
                  >
                    {gate.overlay.text || overlayText}
                  </pre>
                )}
                <OrthoRow
                  ok={gate.caption.ok && !gate.caption.missing}
                  label="Caption de IG (abajo)"
                  detail={
                    gate.caption.missing
                      ? 'Falta caption'
                      : gate.caption.ok
                        ? 'Sin errores'
                        : `${gate.caption.issues.length} a corregir`
                  }
                />
                {[...gate.overlay.issues, ...gate.caption.issues].length > 0 && (
                  <ul className="space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-xs">
                    {[...gate.overlay.issues, ...gate.caption.issues].map((issue, idx) => (
                      <li key={`${issue.surface}-${idx}`}>
                        <span className="font-medium">[{issue.surface}]</span> «{issue.quote}» — {issue.problem}
                        {issue.suggestion ? ` → ${issue.suggestion}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {(stage === 'revision' || stage === 'bloqueado' || stage === 'listo') && ideaId && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3" data-testid="primer-round-review-panel">
            {styleRules.length > 0 && (
              <div className="space-y-1" data-testid="primer-round-style-rules">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Estilo ya enseñado (Primer Round · Reels)
                </p>
                <ul className="space-y-1 rounded-md border bg-background/60 p-2 text-xs">
                  {styleRules.map((rule) => (
                    <li key={rule}>• {rule}</li>
                  ))}
                </ul>
              </div>
            )}
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Enseña el estilo de estos Reels
              </span>
              <p className="text-[11px] text-muted-foreground">
                Se guarda para Primer Round y este tipo de video. El próximo Reel lo usa, no solo este.
              </p>
              <textarea
                data-testid="primer-round-feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                disabled={pending}
                placeholder="Cómo deben sonar estos Reels: gancho, invitado, qué no inventar, tono…"
                className="w-full resize-y rounded-md border bg-background px-3 py-2 text-xs"
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={pending || !feedback.trim()}
              data-testid="primer-round-feedback-cta"
              onClick={applyFeedback}
            >
              {pending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Guardar estilo y reescribir
            </Button>
            {stage === 'bloqueado' && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={overrideOrtho}
                  onChange={(e) => setOverrideOrtho(e.target.checked)}
                />
                Override Eric (enviar el borrador igual)
              </label>
            )}
            <Button
              size="sm"
              className="w-full"
              disabled={
                pending ||
                !canDraft ||
                !caption?.trim() ||
                stage === 'listo' ||
                (stage === 'bloqueado' && !overrideOrtho)
              }
              data-testid="primer-round-draft-cta"
              onClick={sendDraft}
            >
              {pending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Enviar borrador a Metricool
            </Button>
            {metricoolPostId != null && (
              <p className="text-center text-xs text-muted-foreground" data-testid="primer-round-draft-id">
                Metricool #{metricoolPostId}
              </p>
            )}
            {!canDraft && (
              <p className="text-center text-[11px] text-muted-foreground">
                Tu rol no puede enviar el borrador a Metricool.
              </p>
            )}
          </div>
        )}

        {message && (
          <p
            className={cn(
              'rounded-lg border px-3 py-2 text-xs',
              stage === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'bg-muted/30',
            )}
            role="status"
          >
            {message}
          </p>
        )}
      </section>
    </div>
  )
}

function OrthoRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 font-medium">
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        )}
        {label}
      </span>
      <span className={cn('text-[10px]', ok ? 'text-emerald-600' : 'text-amber-600')}>{detail}</span>
    </div>
  )
}
