'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { estadoDelEnlace, puedeVotar, textoDecision } from '@/lib/entregas/client-review'
import { votarRevisionPublica, type RevisionPublica } from '@/lib/actions/entregas-client-review'

/**
 * La pantalla que ve el cliente: su video, dos botones y una caja para escribir.
 *
 * Solo el video, sin el copy: el cliente aprueba la pieza, no revisa el texto.
 * Nada de jerga interna —ni "Editado", ni "pipeline"— porque quien abre esto no
 * conoce el tablero.
 */
export function AprobacionCliente({
  revision,
  token,
  nowISO,
}: {
  revision: RevisionPublica
  token: string
  nowISO: string
}) {
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [enviando, setEnviando] = useState<'approved' | 'rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<'approved' | 'rejected' | null>(null)

  const estado = estadoDelEnlace(
    { status: revision.status, expiresAt: revision.expiresAt, comment: revision.comment, reviewerName: revision.reviewerName },
    new Date(nowISO),
  )
  const abierto = puedeVotar(
    { status: revision.status, expiresAt: revision.expiresAt, comment: revision.comment, reviewerName: revision.reviewerName },
    new Date(nowISO),
  ) && hecho === null

  async function votar(decision: 'approved' | 'rejected') {
    const check = textoDecision(decision, comment)
    if (!check.ok) {
      setError(check.error ?? 'Escribe qué hay que cambiar.')
      return
    }
    setError(null)
    setEnviando(decision)
    const res = await votarRevisionPublica({ token, decision, comment, name })
    setEnviando(null)
    if (res.error) {
      setError(res.error)
      return
    }
    setHecho(decision)
  }

  const decidido = hecho ?? (estado === 'aprobado' ? 'approved' : estado === 'rechazado' ? 'rejected' : null)

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
      <header className="mb-4">
        <h1 className="text-lg font-semibold tracking-tight">
          {revision.clientName ?? 'Tu video'}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Míralo y dinos si lo aprobamos o si hay algo que cambiar.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border bg-card">
        {revision.videoUrl ? (
          <video
            controls
            playsInline
            preload="metadata"
            className="aspect-[9/16] w-full bg-black"
            src={revision.videoUrl}
          >
            Tu navegador no puede reproducir este video.
          </video>
        ) : (
          <div className="flex aspect-[9/16] items-center justify-center bg-muted px-6 text-center text-sm text-muted-foreground">
            El video todavía no está disponible. Escríbenos y te mandamos otro enlace.
          </div>
        )}
      </div>

      {decidido && (
        <div
          className={cn(
            'mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm',
            decidido === 'approved'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
              : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
          )}
        >
          {decidido === 'approved'
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            : <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <p>
            {decidido === 'approved'
              ? '¡Gracias! Ya nos llegó tu aprobación.'
              : 'Recibido. Le pasamos tus comentarios al editor.'}
          </p>
        </div>
      )}

      {estado === 'vencido' && !decidido && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Este enlace venció. Escríbenos y te mandamos uno nuevo.</p>
        </div>
      )}

      {abierto && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="comentarios" className="text-sm font-medium">
              Recomendaciones <span className="font-normal text-muted-foreground">(obligatorio si no lo apruebas)</span>
            </label>
            <textarea
              id="comentarios"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Ej: cortar el logo del final, subir la música…"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="nombre" className="text-sm font-medium">
              Tu nombre <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => votar('approved')}
              disabled={enviando !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {enviando === 'approved'
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              Aprobar
            </button>
            <button
              onClick={() => votar('rejected')}
              disabled={enviando !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
            >
              {enviando === 'rejected'
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                : <XCircle className="h-4 w-4" aria-hidden="true" />}
              No aprobar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
