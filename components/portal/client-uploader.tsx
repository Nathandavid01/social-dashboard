'use client'

import { useRef, useState } from 'react'
import { Upload, Video, Loader2, Check, AlertCircle, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  CONTENT_FORMATS,
  CONTENT_THEMES,
  MAX_UPLOAD_BYTES,
  validateClientUpload,
} from '@/lib/utils/client-upload-core'

type Phase = 'idle' | 'uploading' | 'submitting' | 'done'

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('No se pudo subir el video'))
    xhr.onerror = () => reject(new Error('No se pudo subir el video'))
    xhr.send(file)
  })
}

function prettySize(bytes: number) {
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`
}

export function ClientUploader({
  clientId,
  clientName,
  logoUrl,
}: {
  clientId: string
  clientName: string
  logoUrl?: string | null
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState('')
  const [theme, setTheme] = useState('')
  const [brief, setBrief] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const busy = phase === 'uploading' || phase === 'submitting'
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local tz

  async function handleSubmit() {
    setError('')
    const v = validateClientUpload({ format, theme, brief, desiredDate })
    if (!v.ok) return setError(v.error!)
    if (!file) return setError('Selecciona o graba un video.')
    if (file.size > MAX_UPLOAD_BYTES) return setError('El video supera el tamaño máximo (5 GB).')

    try {
      setPhase('uploading')
      setProgress(0)
      const pres = await fetch('/api/client-upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, fileName: file.name, contentType: file.type }),
      }).then((r) => r.json())
      if (!pres.url) throw new Error(pres.error || 'No se pudo iniciar la subida')

      await putWithProgress(pres.url, file, setProgress)

      setPhase('submitting')
      const sub = await fetch('/api/client-upload/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          key: pres.key,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          format,
          theme,
          brief,
          desiredDate,
        }),
      }).then((r) => r.json())
      if (!sub.ok) throw new Error(sub.error || 'No se pudo enviar')

      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Algo salió mal. Intenta de nuevo.')
      setPhase('idle')
    }
  }

  function reset() {
    setFile(null)
    setFormat('')
    setTheme('')
    setBrief('')
    setDesiredDate('')
    setProgress(0)
    setError('')
    setPhase('idle')
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-5 py-10 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold">¡Recibimos tu video!</h1>
        <p className="text-sm text-muted-foreground">
          El equipo de Nate Media ya tiene tu material y empezará a editarlo. Te avisaremos cuando esté listo.
        </p>
        <Button variant="outline" onClick={reset}>
          Subir otro video
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={clientName} className="h-11 w-11 rounded-xl object-cover" />
        ) : (
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <Video className="h-5 w-5" />
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Sube tu contenido para</p>
          <h1 className="text-lg font-bold leading-tight">{clientName}</h1>
        </div>
      </header>

      <div className="space-y-6">
        {/* 1. Video */}
        <section className="space-y-2">
          <p className="text-sm font-semibold">1. Tu video</p>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              setError('')
              setFile(e.target.files?.[0] ?? null)
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              file ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40',
            )}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            {file ? (
              <span className="text-sm font-medium">
                {file.name} <span className="text-muted-foreground">({prettySize(file.size)})</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Toca para grabar o elegir un video</span>
            )}
          </button>
        </section>

        {/* 2. Format */}
        <section className="space-y-2">
          <p className="text-sm font-semibold">2. ¿Qué tipo de contenido?</p>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                disabled={busy}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  format === f.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40',
                )}
              >
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              </button>
            ))}
          </div>
        </section>

        {/* 3. Theme */}
        <section className="space-y-2">
          <p className="text-sm font-semibold">3. ¿De qué se trata?</p>
          <div className="flex flex-wrap gap-2">
            {CONTENT_THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTheme(t.value)}
                disabled={busy}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  theme === t.value
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* 4. Brief */}
        <section className="space-y-2">
          <p className="text-sm font-semibold">
            4. ¿Algo que debamos saber? <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Mensaje, llamado a la acción, qué destacar…"
            rows={3}
            disabled={busy}
          />
        </section>

        {/* 5. Desired date */}
        <section className="space-y-2">
          <p className="text-sm font-semibold">
            5. ¿Para cuándo? <span className="font-normal text-muted-foreground">(opcional)</span>
          </p>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={desiredDate}
              min={today}
              onChange={(e) => setDesiredDate(e.target.value)}
              disabled={busy}
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
            />
          </div>
        </section>

        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {busy && (
          <div className="space-y-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${phase === 'submitting' ? 100 : progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {phase === 'submitting' ? 'Enviando al equipo…' : `Subiendo… ${progress}%`}
            </p>
          </div>
        )}

        <Button onClick={handleSubmit} disabled={busy} className="h-11 w-full text-base">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Enviar mi video
        </Button>
      </div>
    </div>
  )
}
