'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link2, Copy, Check, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { estadoDelEnlace, DIAS_DE_VIGENCIA, type EstadoEnlace } from '@/lib/entregas/client-review'
import { crearEnlaceCliente, getEnlaceCliente, type EnlaceGuardado } from '@/lib/actions/entregas-client-review'

/**
 * El enlace que se le manda al cliente para que apruebe su video.
 *
 * Vive en la tarjeta de Copy porque es el momento en que la pieza está lista y
 * alguien la va a mandar por WhatsApp. Genera, copia y enseña en qué quedó.
 */

const TONO: Record<EstadoEnlace, string> = {
  sin_enlace: 'text-muted-foreground',
  esperando: 'text-amber-600 dark:text-amber-400',
  aprobado: 'text-emerald-600 dark:text-emerald-400',
  rechazado: 'text-rose-600 dark:text-rose-400',
  vencido: 'text-muted-foreground',
}

const ETIQUETA: Record<EstadoEnlace, string> = {
  sin_enlace: 'Sin enviar',
  esperando: 'Esperando al cliente',
  aprobado: 'Aprobado por el cliente',
  rechazado: 'El cliente pidió cambios',
  vencido: 'Enlace vencido',
}

export function EnlaceClientePanel({ ideaId }: { ideaId: string }) {
  const { toast } = useToast()
  const [enlace, setEnlace] = useState<EnlaceGuardado | null>(null)
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const res = await getEnlaceCliente(ideaId)
    setEnlace(res.enlace ?? null)
    setCargando(false)
  }, [ideaId])

  useEffect(() => { void cargar() }, [cargar])

  const estado = estadoDelEnlace(enlace)
  // window en el cliente: el enlace tiene que llevar el dominio desde el que se
  // está trabajando, no uno fijo que caducaría al cambiar de dominio.
  const url = enlace ? `${typeof window !== 'undefined' ? window.location.origin : ''}/aprobacion/${enlace.token}` : ''

  async function generar() {
    setGenerando(true)
    const res = await crearEnlaceCliente(ideaId)
    setGenerando(false)
    if (res.error) {
      toast({ title: 'No se pudo generar', description: res.error, variant: 'destructive' })
      return
    }
    await cargar()
    toast({ title: 'Enlace listo', description: `Vence en ${DIAS_DE_VIGENCIA} días.` })
  }

  async function copiar() {
    await navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-3 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Cargando enlace…
      </div>
    )
  }

  return (
    <section className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">Aprobación del cliente</span>
        </h3>
        <span className={cn('flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium', TONO[estado])}>
          {estado === 'aprobado' && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
          {estado === 'rechazado' && <XCircle className="h-3 w-3" aria-hidden="true" />}
          {estado === 'vencido' && <Clock className="h-3 w-3" aria-hidden="true" />}
          {ETIQUETA[estado]}
        </span>
      </div>

      {enlace && estado !== 'sin_enlace' && (
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={url}
            aria-label="Enlace para el cliente"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-1.5 text-[11px] text-muted-foreground outline-none"
          />
          <button
            onClick={copiar}
            aria-label="Copiar enlace"
            className="shrink-0 rounded-lg border p-1.5 transition hover:bg-muted"
          >
            {copiado
              ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      )}

      {/* Lo que el cliente escribió. Si pidió cambios, el video ya volvió a
          Editado — decirlo aquí evita buscarlo en la columna equivocada. */}
      {enlace?.comment && (
        <div className="rounded-lg border border-border bg-muted/40 p-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {enlace.reviewerName || 'El cliente'} escribió
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-snug">{enlace.comment}</p>
        </div>
      )}
      {estado === 'rechazado' && (
        <p className="text-[11px] text-muted-foreground">
          El video volvió a <strong className="text-foreground">Editado</strong> con este texto.
        </p>
      )}

      <button
        onClick={generar}
        disabled={generando}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition hover:bg-muted disabled:opacity-50"
      >
        {generando
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          : <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
        {estado === 'sin_enlace' ? 'Generar enlace' : 'Generar uno nuevo'}
      </button>
      {estado !== 'sin_enlace' && (
        <p className="text-[10px] text-muted-foreground">
          Generar uno nuevo invalida el anterior.
        </p>
      )}
    </section>
  )
}
