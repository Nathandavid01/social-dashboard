'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Upload,
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ClientLogo } from '@/components/clients/client-logo'
import { cn } from '@/lib/utils'
import {
  acceptPrimerRoundPiece,
  createPrimerRoundUploadIdea,
  revisePrimerRoundCaption,
  runPrimerRoundUploadPipeline,
  type PrimerRoundStudioPayload,
} from '@/lib/actions/primer-round'
import { registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'
import { reportUploadFailure } from '@/lib/actions/pipeline-submit'
import type { PrimerRoundOrthoGate } from '@/lib/primer-round/orthography'
import { assertPrimerRoundMp4, primerRoundUploadContentType } from '@/lib/primer-round/studio'
import { PRIMER_ROUND_CAPTION_HOSTS } from '@/lib/primer-round/caption-template'
import { primerRoundNextAirCopy, PRIMER_ROUND_AIR_CLOCK } from '@/lib/primer-round/air-time'
import { normalizePrimerRoundCaption } from '@/lib/primer-round/caption-template'
import { useRouter } from 'next/navigation'

type PipelineStage =
  | 'idle'
  | 'creando'
  | 'subiendo'
  | 'analizando'
  | 'caption'
  | 'verificando'
  | 'revision'
  | 'agendando'
  | 'listo'
  | 'bloqueado'
  | 'error'

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<{ key: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { key?: string }
          if (body.key) return resolve({ key: body.key })
        } catch {
          /* fall through */
        }
        void reportUploadFailure(`${file.name} (${file.size}b) → HTTP ${xhr.status} sin key`)
        return reject(new Error('No se pudo guardar el video'))
      }
      void reportUploadFailure(
        `${file.name} (${file.size}b) → HTTP ${xhr.status} :: ${(xhr.responseText || '').slice(0, 300)}`,
      )
      reject(new Error(`La subida falló (${xhr.status})`))
    }
    xhr.onerror = () => {
      void reportUploadFailure(
        `${file.name} (${file.size}b) → onerror, sin status (CORS, red o subida interrumpida)`,
      )
      reject(
        new Error(
          'Se cortó la subida. Revisa tu conexión e inténtalo otra vez; ' +
            'si se repite, abre la consola del navegador (pestaña Red) para ver el error real.',
        ),
      )
    }
    xhr.ontimeout = () => {
      void reportUploadFailure(`${file.name} (${file.size}b) → timeout`)
      reject(new Error('La subida tardó demasiado'))
    }
    xhr.send(file)
  })
}

const STAGE_LABEL: Record<PipelineStage, string> = {
  idle: 'Listo para subir',
  creando: 'Creando pieza…',
  subiendo: 'Subiendo video…',
  analizando: 'IA leyendo overlay…',
  caption: 'IA creando caption IG…',
  verificando: 'IA verificando ortografía…',
  revision: 'Pendiente de tu OK',
  agendando: 'Publicando en Instagram, Facebook y TikTok…',
  listo: 'Listo',
  bloqueado: 'Verificación pendiente',
  error: 'Error',
}

export function PrimerRoundStudio({ studio }: { studio: PrimerRoundStudioPayload }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [pct, setPct] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const [gate, setGate] = useState<PrimerRoundOrthoGate | null>(null)
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [overrideOrtho, setOverrideOrtho] = useState(false)
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [overlayText, setOverlayText] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [styleRules, setStyleRules] = useState<string[]>(studio.styleRules ?? [])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const piece = studio.pending
    if (!piece || ideaId) return
    setIdeaId(piece.ideaId)
    setVideoId(piece.videoId)
    setFileLabel(piece.fileName)
    setCaption(piece.caption ? normalizePrimerRoundCaption(piece.caption) : piece.caption)
    setOverlayText(piece.overlayText)
    setPreviewUrl((prev) => {
      if (prev?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(prev)
      return piece.previewUrl
    })
    setStage('revision')
    setMessage('El video se queda aquí hasta que lo aceptes o le des feedback a la IA.')
  }, [studio.pending, ideaId])

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  async function runPipeline(id: string, vid: string | null) {
    setStage('caption')
    setMessage('IA generando caption (plantilla @primerroundoficial)…')
    const res = await runPrimerRoundUploadPipeline({
      ideaId: id,
      videoId: vid,
    })
    if (res.caption) setCaption(normalizePrimerRoundCaption(res.caption))
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
    setMessage(
      res.error ??
        'El video se queda aquí hasta que lo aceptes o le des feedback a la IA.',
    )
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

    setPreviewUrl((prev) => {
      if (prev && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setFileLabel(file.name)
    setCaption(null)
    setGate(null)
    setOverlayText(null)
    setFeedback('')
    setOverrideOrtho(false)
    setMessage(null)
    setIdeaId(null)
    setVideoId(null)
    setPct(0)

    startTransition(async () => {
      try {
        setStage('creando')
        const created = await createPrimerRoundUploadIdea({
          fileName: file.name,
          title: null,
        })
        if (created.error || !created.ideaId) {
          setStage('error')
          setMessage(created.error ?? 'No se pudo crear la pieza')
          return
        }
        setIdeaId(created.ideaId)

        setStage('subiendo')
        const uploaded = await putWithProgress(
          `/api/entregas-upload?ideaId=${encodeURIComponent(created.ideaId)}&fileName=${encodeURIComponent(file.name)}`,
          file,
          contentType,
          setPct,
        )

        const reg = await registerEntregasVideo({
          ideaId: created.ideaId,
          key: uploaded.key,
          name: file.name,
          sizeBytes: file.size,
          mimeType: contentType,
        })
        if (reg.error || !reg.id) {
          setStage('error')
          setMessage(reg.error ?? 'No se pudo registrar el video')
          return
        }
        setVideoId(reg.id)

        setStage('analizando')
        setMessage('IA leyendo textos en pantalla y de qué va el video…')
        const processed = await processUploadedVideo(reg.id, file)
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
        setStage('error')
        setMessage(err instanceof Error ? err.message : 'Error inesperado')
      }
    })
  }

  function applyFeedback() {
    if (!ideaId || !feedback.trim()) return
    startTransition(async () => {
      setStage('caption')
      setMessage('IA aplicando tu feedback…')
      const res = await revisePrimerRoundCaption({
        ideaId,
        feedback: feedback.trim(),
        previousCaption: caption,
      })
      if (res.caption) setCaption(normalizePrimerRoundCaption(res.caption))
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
      setMessage(res.error ?? 'Estilo guardado para los Reels de Primer Round. Acepta o sigue enseñando.')
    })
  }

  function acceptPiece() {
    if (!ideaId) return
    startTransition(async () => {
      setStage('agendando')
      const res = await acceptPrimerRoundPiece({
        ideaId,
        videoId,
        overrideOrtho,
      })
      if (res.caption) setCaption(normalizePrimerRoundCaption(res.caption))
      if (res.gate) setGate(res.gate)
      if (res.error) {
        setStage('error')
        setMessage(res.error)
        return
      }
      if (res.skipped) {
        setStage('bloqueado')
        setMessage(res.skipped)
        return
      }
      setStage('listo')
      setMessage(
        `Publicado en Instagram, Facebook y TikTok${
          res.metricoolPostId != null ? ` #${res.metricoolPostId}` : ''
        } (collabs en IG).`,
      )
      router.refresh()
    })
  }

  const waiting = stage === 'idle' || stage === 'listo' || stage === 'bloqueado' || stage === 'error' || stage === 'revision'
  const busy = pending || !waiting

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
          Sube el mp4 o mov: ves la película, la IA lee los textos y arma el caption
          (hosts {PRIMER_ROUND_CAPTION_HOSTS}). El video se queda aquí hasta que lo aceptes
          o le des feedback. Al aceptar, se publica en Instagram, Facebook y TikTok
          (collabs IG). Al aire lun–vie {PRIMER_ROUND_AIR_CLOCK}. Si publicas ahora:{' '}
          {primerRoundNextAirCopy().phrase}.
        </p>
      </header>

      <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-4 sm:p-6" data-testid="primer-round-upload-panel">
        <div className="text-center space-y-1">
          <h2 className="text-sm font-semibold">Subir video</h2>
          <p className="text-xs text-muted-foreground">mp4 o mov. La IA lee el video; tú aceptas o le das feedback.</p>
        </div>

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
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload video
        </Button>

        {previewUrl && (
          <video
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

        {(stage === 'revision' || stage === 'bloqueado') && ideaId && (
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
                Override Eric (publicar igual)
              </label>
            )}
            <Button
              size="sm"
              className="w-full"
              disabled={pending || (stage === 'bloqueado' && !overrideOrtho)}
              data-testid="primer-round-accept-cta"
              onClick={acceptPiece}
            >
              {pending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Aceptar y publicar
            </Button>
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
