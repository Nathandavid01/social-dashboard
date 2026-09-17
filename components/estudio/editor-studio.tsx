'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import {
  Upload,
  Users,
  Loader2,
  CheckCircle2,
  Square,
  Sparkles,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ClientLogo } from '@/components/clients/client-logo'
import { cn } from '@/lib/utils'
import {
  createEditorStudioIdea,
  generateEditorStudioCaption,
  pushEditorStudioDraft,
  type EditorStudioPayload,
} from '@/lib/actions/editor-studio'
import { registerEntregasVideo } from '@/lib/actions/entregas-r2'
import { processUploadedVideo } from '@/lib/utils/video-postupload-client'
import { isUploadAbortError, uploadEntregasFileFast } from '@/lib/utils/entregas-fast-upload'
import { assertPrimerRoundMp4, primerRoundUploadContentType } from '@/lib/primer-round/studio'
import {
  PRIMER_ROUND_LIVE_CLIP_ATTRIBUTION,
} from '@/lib/primer-round/caption-template'
import type { PrimerRoundPieceKind } from '@/lib/primer-round/caption-template'
import {
  assertEditorStudioFileSize,
  formatEditorStudioBytes,
} from '@/lib/estudio/upload-limit'

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
  revision: 'Revisa el caption',
  enviando: 'Creando borrador en Metricool…',
  listo: 'Borrador listo',
  error: 'Error',
}

export function EditorStudio({ studio }: { studio: EditorStudioPayload }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const [clientId, setClientId] = useState(studio.clients[0]?.id ?? '')
  const [pieceKind, setPieceKind] = useState<PrimerRoundPieceKind>('gfx')
  const [collabOn, setCollabOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(studio.primerRoundCollabs.map((c) => [c.username, true])),
  )
  const [extraCollabs, setExtraCollabs] = useState('')
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [pct, setPct] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [visualSummary, setVisualSummary] = useState<string | null>(null)
  const [ideaId, setIdeaId] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [fileLabel, setFileLabel] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [metricoolPostId, setMetricoolPostId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const client = useMemo(
    () => studio.clients.find((c) => c.id === clientId) ?? null,
    [studio.clients, clientId],
  )
  const isPrimerRound = !!client?.isPrimerRound
  const selectedCollabs = studio.primerRoundCollabs
    .filter((c) => collabOn[c.username])
    .map((c) => c.username)
  const extraUsernames = extraCollabs
    .split(/[,\s]+/)
    .map((s) => s.trim().replace(/^@/, ''))
    .filter(Boolean)

  function resetToBlank() {
    cancelledRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    setStage('idle')
    setPct(0)
    setMessage(null)
    setCaption('')
    setVisualSummary(null)
    setIdeaId(null)
    setVideoId(null)
    setFileLabel(null)
    setPreviewUrl(null)
    setMetricoolPostId(null)
  }

  function stopUpload() {
    cancelledRef.current = true
    abortRef.current?.abort()
    abortRef.current = null
    resetToBlank()
  }

  function onPickFile(file: File | null) {
    if (!file) return
    if (!clientId) {
      setStage('error')
      setMessage('Elige un cliente')
      return
    }
    const contentType = primerRoundUploadContentType({ fileName: file.name, contentType: file.type })
    const guard = assertPrimerRoundMp4({ fileName: file.name, contentType })
    if (guard) {
      setStage('error')
      setMessage(guard)
      return
    }
    const sizeErr = assertEditorStudioFileSize(file.size)
    if (sizeErr) {
      setStage('error')
      setMessage(sizeErr)
      return
    }

    cancelledRef.current = false
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setPreviewUrl(URL.createObjectURL(file))
    setFileLabel(file.name)
    setCaption('')
    setVisualSummary(null)
    setIdeaId(null)
    setVideoId(null)
    setMetricoolPostId(null)
    setPct(0)
    setMessage(null)

    startTransition(async () => {
      try {
        setStage('creando')
        const created = await createEditorStudioIdea({
          clientId,
          fileName: file.name,
          title: null,
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

        setStage('caption')
        setMessage('IA armando el caption (sin inventar palabras dichas)…')
        const cap = await generateEditorStudioCaption({
          ideaId: created.ideaId,
          videoId: reg.id,
          pieceKind: isPrimerRound ? pieceKind : null,
        })
        if (cancelledRef.current) return
        if (cap.error && !cap.caption) {
          setStage('error')
          setMessage(cap.error)
          return
        }
        setCaption(cap.caption ?? '')
        setVisualSummary(cap.visualSummary ?? null)
        setStage('revision')
        setMessage(cap.error ?? 'Revisa el caption. Luego se crea un borrador en Metricool — no se publica.')
      } catch (err) {
        if (cancelledRef.current || isUploadAbortError(err)) return
        setStage('error')
        setMessage(err instanceof Error ? err.message : 'Error inesperado')
      }
    })
  }

  function sendDraft() {
    if (!ideaId || !videoId || !caption.trim()) return
    startTransition(async () => {
      setStage('enviando')
      setMessage('Creando borrador en Metricool (no se publica en vivo)…')
      const includeCollabs = isPrimerRound ? selectedCollabs.length > 0 : extraUsernames.length > 0
      const res = await pushEditorStudioDraft({
        ideaId,
        videoId,
        caption: caption.trim(),
        includeCollabs,
        collabUsernames: isPrimerRound ? selectedCollabs : extraUsernames,
      })
      if (res.error) {
        setStage('error')
        setMessage(res.error)
        return
      }
      setMetricoolPostId(res.metricoolPostId ?? null)
      setStage('listo')
      setMessage(
        `Borrador en Metricool${res.metricoolPostId != null ? ` #${res.metricoolPostId}` : ''}. No se publicó. Eric aprueba después.`,
      )
    })
  }

  const waiting = stage === 'idle' || stage === 'listo' || stage === 'error' || stage === 'revision'
  const busy = pending || !waiting
  const canStop =
    stage === 'creando' || stage === 'subiendo' || stage === 'analizando' || stage === 'caption'

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
            {client ? (
              <ClientLogo name={client.name} logoUrl={client.logoUrl} className="h-10 w-10 text-[11px]" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Upload className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Estudio</h1>
              <p className="truncate text-xs text-muted-foreground">
                Sube → IA lee → caption → borrador en Metricool (no se publica)
              </p>
            </div>
          </div>
          <Badge variant="secondary">máx. {formatEditorStudioBytes(studio.maxUploadBytes)}</Badge>
        </div>
        <p className="relative mt-3 text-xs text-muted-foreground">
          El archivo va directo a Entregas (presign / partes). No pasa por Vercel (~4.5 MB). El proxy
          same-origin sigue en 200 MB; este flujo llega a {studio.uploadLimits.productLabel}.
        </p>
      </header>

      <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-4 sm:p-6" data-testid="estudio-upload-panel">
        <div className="space-y-1">
          <label htmlFor="estudio-client" className="text-sm font-medium">
            Cliente
          </label>
          <select
            id="estudio-client"
            data-testid="estudio-client"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={clientId}
            disabled={busy || !!ideaId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {studio.clients.length === 0 && <option value="">No hay clientes asignados</option>}
            {studio.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.blogId ? ' (sin Metricool)' : ''}
              </option>
            ))}
          </select>
          {client && !client.blogId && (
            <p className="text-xs text-amber-500">Este cliente no tiene blog de Metricool.</p>
          )}
        </div>

        {isPrimerRound && (
          <fieldset className="space-y-2 rounded-lg border bg-muted/20 p-3" data-testid="estudio-piece-kind">
            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo de pieza Primer Round
            </legend>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="piece-kind"
                value="gfx"
                checked={pieceKind === 'gfx'}
                disabled={busy || !!ideaId}
                onChange={() => setPieceKind('gfx')}
              />
              <span>
                GFX / promo — «Mañana desde las 5:43 AM junto a @rafaellenin y @denniseyperez»
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="piece-kind"
                value="live"
                checked={pieceKind === 'live'}
                disabled={busy || !!ideaId}
                onChange={() => setPieceKind('live')}
              />
              <span>Clip en vivo — «{PRIMER_ROUND_LIVE_CLIP_ATTRIBUTION.replace(/\.$/, '')}»</span>
            </label>
          </fieldset>
        )}

        {isPrimerRound ? (
          <div className="space-y-2" data-testid="estudio-collabs">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Users className="h-3 w-3" /> Collabs Instagram
            </p>
            {studio.primerRoundCollabs.map((c) => (
              <label key={c.username} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid={`estudio-collab-${c.username}`}
                  checked={!!collabOn[c.username]}
                  disabled={busy}
                  onChange={(e) => setCollabOn((prev) => ({ ...prev, [c.username]: e.target.checked }))}
                />
                <span>
                  @{c.username} <span className="text-muted-foreground">({c.label})</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <label htmlFor="estudio-extra-collabs" className="text-xs font-medium text-muted-foreground">
              Collabs Instagram (opcional)
            </label>
            <input
              id="estudio-extra-collabs"
              data-testid="estudio-extra-collabs"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="usuario1, usuario2"
              value={extraCollabs}
              disabled={busy}
              onChange={(e) => setExtraCollabs(e.target.value)}
            />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          className="sr-only"
          data-testid="estudio-upload-input"
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
          disabled={busy || !clientId}
          data-testid="estudio-upload-cta"
          onClick={() => {
            if (stage !== 'idle' && stage !== 'revision') resetToBlank()
            inputRef.current?.click()
          }}
        >
          {busy && stage !== 'revision' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Subir video
        </Button>

        {canStop && (
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2"
            data-testid="estudio-stop-cta"
            onClick={stopUpload}
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Detener
          </Button>
        )}

        {previewUrl && (
          <video
            data-testid="estudio-video-preview"
            src={previewUrl}
            controls
            playsInline
            className="aspect-[9/16] w-full max-h-[28rem] rounded-lg bg-black object-contain"
          />
        )}

        {(stage !== 'idle' || fileLabel) && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3" data-testid="estudio-pipeline-status">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium">{STAGE_LABEL[stage]}</span>
              {fileLabel && <span className="truncate text-muted-foreground">{fileLabel}</span>}
            </div>
            {stage === 'subiendo' && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            {message && <p className={cn('text-xs', stage === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{message}</p>}
            {visualSummary && (
              <p className="text-xs text-muted-foreground" data-testid="estudio-analysis">
                {visualSummary}
              </p>
            )}
            {(caption || stage === 'revision' || stage === 'listo') && (
              <div className="space-y-1" data-testid="estudio-caption-panel">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3" /> Caption
                </p>
                <Textarea
                  data-testid="estudio-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={busy && stage !== 'revision'}
                  className="min-h-[9rem] whitespace-pre-wrap text-sm"
                />
              </div>
            )}
          </div>
        )}

        {stage === 'revision' && (
          <Button
            size="lg"
            className="w-full gap-2"
            disabled={!caption.trim() || pending}
            data-testid="estudio-draft-cta"
            onClick={sendDraft}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Crear borrador en Metricool
          </Button>
        )}

        {stage === 'listo' && (
          <p className="flex items-center gap-2 text-sm text-emerald-400" data-testid="estudio-draft-ok">
            <CheckCircle2 className="h-4 w-4" />
            Borrador{metricoolPostId != null ? ` #${metricoolPostId}` : ''} — no se publicó en vivo.
          </p>
        )}
      </section>
    </div>
  )
}
