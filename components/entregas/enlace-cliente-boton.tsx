'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link2, Copy, Check, Loader2, CheckCircle2, XCircle, ExternalLink, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { DIAS_DE_VIGENCIA } from '@/lib/entregas/client-review'
import { crearEnlaceCliente, getEnlaceCliente, type EnlaceGuardado } from '@/lib/actions/entregas-client-review'
import { getEntregaVideoEditado, getEntregasDownloadUrl } from '@/lib/actions/entregas-r2'

/**
 * El enlace de aprobación, en la propia tarjeta del tablero.
 *
 * Un enlace por VIDEO: la tarjeta es un video, así que lo que sale de ella
 * también. Un clic desde el tablero, que es cuando de verdad se manda por
 * WhatsApp, sin tener que abrir nada.
 *
 * Con el enlace ya generado, la tarjeta ofrece además "Abrir" —para revisar
 * exactamente lo que ve el cliente— y "Bajar" —el video editado vigente, sin
 * entrar a la idea.
 */
export function EnlaceClienteBoton({
  clientId,
  clientName,
  ideaId,
}: {
  clientId: string
  clientName: string
  /** El video de ESTA tarjeta: un enlace por video. */
  ideaId: string
}) {
  const { toast } = useToast()
  const [enlace, setEnlace] = useState<EnlaceGuardado | null>(null)
  const [editedVideoId, setEditedVideoId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [bajando, setBajando] = useState(false)

  const cargar = useCallback(async () => {
    const [enlaceRes, videoRes] = await Promise.all([
      getEnlaceCliente(ideaId),
      getEntregaVideoEditado(ideaId),
    ])
    setEnlace(enlaceRes.enlace ?? null)
    setEditedVideoId(videoRes.id ?? null)
    setCargando(false)
  }, [ideaId])

  useEffect(() => { void cargar() }, [cargar])

  // window en el cliente: el enlace lleva el dominio desde el que se trabaja, no
  // uno fijo que dejaría de valer al cambiar de dominio.
  const url = enlace ? `${typeof window !== 'undefined' ? window.location.origin : ''}/aprobacion/${enlace.token}` : ''

  const votados = enlace?.videos.filter((v) => v.status !== 'pending').length ?? 0
  const rechazados = enlace?.videos.filter((v) => v.status === 'rejected').length ?? 0
  const totalEnlace = enlace?.videos.length ?? 0

  // Detiene la propagación en todo el bloque: la tarjeta entera abre el overlay
  // al pulsarla, y ninguna de estas acciones debe abrirlo.
  function parar(e: React.MouseEvent) {
    e.stopPropagation()
  }

  async function generar(e: React.MouseEvent) {
    parar(e)
    setGenerando(true)
    const res = await crearEnlaceCliente({ clientId, ideaIds: [ideaId] })
    setGenerando(false)
    if (res.error) {
      toast({ title: 'No se pudo generar', description: res.error, variant: 'destructive' })
      return
    }
    await cargar()
    toast({ title: `Enlace de ${clientName}`, description: `Listo para enviar. Vence en ${DIAS_DE_VIGENCIA} días.` })
  }

  async function copiar(e: React.MouseEvent) {
    parar(e)
    await navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
    toast({ title: 'Enlace copiado' })
  }

  async function bajar(e: React.MouseEvent) {
    parar(e)
    if (!editedVideoId || bajando) return
    setBajando(true)
    const res = await getEntregasDownloadUrl(editedVideoId)
    setBajando(false)
    if (res.error || !res.url) {
      toast({ title: 'No se pudo descargar', description: res.error ?? 'Error inesperado', variant: 'destructive' })
      return
    }
    window.open(res.url, '_blank')
  }

  if (cargando) return null

  return (
    <div onClick={parar} className="flex items-center gap-1">
      {enlace ? (
        <>
          <button
            onClick={copiar}
            aria-label={`Copiar enlace de aprobación de ${clientName}`}
            className="flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition hover:bg-muted"
          >
            {copiado
              ? <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
              : <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />}
            Enlace
          </button>
          <a
            href={`/aprobacion/${enlace.token}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={parar}
            aria-label={`Abrir lo que ve ${clientName} en su enlace de aprobación`}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-1 text-[10px] font-medium transition hover:bg-muted"
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            Abrir
          </a>
          {editedVideoId && (
            <button
              onClick={bajar}
              disabled={bajando}
              aria-label={`Bajar el video editado de ${clientName}`}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-1 text-[10px] font-medium transition hover:bg-muted disabled:opacity-50"
            >
              {bajando
                ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
                : <Download className="h-3 w-3 shrink-0" aria-hidden="true" />}
              Bajar
            </button>
          )}
          {votados > 0 && (
            <span
              className={cn(
                'flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[10px] font-medium',
                rechazados > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {rechazados > 0
                ? <XCircle className="h-3 w-3" aria-hidden="true" />
                : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
              {votados}/{totalEnlace}
            </span>
          )}
        </>
      ) : (
        <button
          onClick={generar}
          disabled={generando}
          aria-label={`Generar enlace de aprobación para ${clientName}`}
          className="flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {generando
            ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            : <Link2 className="h-3 w-3" aria-hidden="true" />}
          Enlace cliente
        </button>
      )}
    </div>
  )
}
