'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Check, ExternalLink, Plus, X, Loader2, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { SHOT_TYPES, groupShots, progressOf, type OnsiteShot } from '@/lib/onsite/shot-types'
import {
  toggleShotRecorded,
  removeShotFromSession,
  updateShotDetails,
  addIdeaToSession,
  type AddableIdea,
} from '@/lib/actions/onsite'

/**
 * La lista de grabación de una sesión.
 *
 * Acordeón por tipo de cámara: quien está grabando trabaja un tipo a la vez, y
 * una lista plana obliga a subir y bajar buscando la siguiente toma del mismo
 * equipo. Los grupos se pueden cerrar para concentrarse en uno.
 *
 * El contador de abajo se recalcula al marcar, sin recargar: es lo que se mira
 * para saber cuánto queda.
 */
export function OnsiteChecklist({
  sessionId,
  initialShots,
  addable,
}: {
  sessionId: string
  initialShots: OnsiteShot[]
  addable: AddableIdea[]
}) {
  const { toast } = useToast()
  const [shots, setShots] = useState(initialShots)
  const [abiertos, setAbiertos] = useState<Set<string>>(
    // Todo abierto al entrar: cerrar es una decisión, esconder por defecto es
    // hacer que la gente busque su trabajo.
    () => new Set([...SHOT_TYPES.map((t) => t.key as string), 'sin_tipo']),
  )
  const [ocupado, setOcupado] = useState<Set<string>>(new Set())
  const [añadiendo, setAñadiendo] = useState(false)
  const [tipoNuevo, setTipoNuevo] = useState<string>(SHOT_TYPES[0].key)

  const grupos = useMemo(() => groupShots(shots), [shots])
  const prog = useMemo(() => progressOf(shots), [shots])

  function marcarOcupado(id: string, on: boolean) {
    setOcupado((s) => {
      const n = new Set(s)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  }

  async function toggle(shot: OnsiteShot) {
    const siguiente = !shot.recorded
    // Optimista: grabando no se espera a la red para tachar una toma.
    setShots((ss) => ss.map((s) => (s.id === shot.id ? { ...s, recorded: siguiente } : s)))
    marcarOcupado(shot.id, true)
    const res = await toggleShotRecorded({ ideaId: shot.id, recorded: siguiente })
    marcarOcupado(shot.id, false)
    if (res.error) {
      setShots((ss) => ss.map((s) => (s.id === shot.id ? { ...s, recorded: shot.recorded } : s)))
      toast({ title: 'No se pudo marcar', description: res.error, variant: 'destructive' })
    }
  }

  async function quitar(shot: OnsiteShot) {
    setShots((ss) => ss.filter((s) => s.id !== shot.id))
    const res = await removeShotFromSession(shot.id)
    if (res.error) {
      setShots(initialShots)
      toast({ title: 'No se pudo quitar', description: res.error, variant: 'destructive' })
    }
  }

  async function cambiarTipo(shot: OnsiteShot, shotType: string) {
    setShots((ss) => ss.map((s) => (s.id === shot.id ? { ...s, shotType } : s)))
    const res = await updateShotDetails({ ideaId: shot.id, shotType })
    if (res.error) toast({ title: 'No se pudo cambiar el tipo', description: res.error, variant: 'destructive' })
  }

  async function añadir(idea: AddableIdea) {
    marcarOcupado(idea.id, true)
    const res = await addIdeaToSession({ sessionId, ideaId: idea.id, source: idea.source, shotType: tipoNuevo })
    marcarOcupado(idea.id, false)
    if (res.error) {
      toast({ title: 'No se pudo añadir', description: res.error, variant: 'destructive' })
      return
    }
    // Del Lab se COPIA a content_ideas, así que su id no sirve aquí: recargamos
    // para tomar la fila nueva con su id real.
    window.location.reload()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <button
          onClick={() => setAñadiendo((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition hover:bg-muted"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Añadir ideas ({addable.length})
        </button>
        <div className="flex flex-wrap gap-1">
          {grupos.map((g) => (
            <button
              key={g.key}
              onClick={() => setAbiertos(new Set([g.key]))}
              className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {g.label} <span className="tabular-nums">{g.recorded}/{g.shots.length}</span>
            </button>
          ))}
        </div>
      </div>

      {añadiendo && (
        <section className="space-y-2 rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Añadir como:</span>
            {SHOT_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setTipoNuevo(t.key)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] transition',
                  tipoNuevo === t.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {addable.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-muted-foreground">
              No hay ideas sueltas de este cliente ni aprobadas en el Lab.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {addable.map((i) => (
                <li key={`${i.source}:${i.id}`} className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[12px]">{i.title}</span>
                  {i.source === 'lab' && (
                    <span className="shrink-0 rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 text-[9px] font-semibold text-purple-500">
                      Lab
                    </span>
                  )}
                  <button
                    onClick={() => añadir(i)}
                    disabled={ocupado.has(i.id)}
                    className="shrink-0 rounded-md border px-2 py-0.5 text-[11px] transition hover:bg-muted disabled:opacity-50"
                  >
                    {ocupado.has(i.id) ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : 'Añadir'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {grupos.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-10 text-center">
          <Camera className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Esta sesión no tiene tomas todavía</p>
          <p className="text-xs text-muted-foreground">Añade ideas del cliente o del Idea Lab.</p>
        </div>
      )}

      {grupos.map((g) => {
        const abierto = abiertos.has(g.key)
        return (
          <section key={g.key} className="overflow-hidden rounded-xl border bg-card">
            <button
              onClick={() => setAbiertos((s) => {
                const n = new Set(s)
                if (n.has(g.key)) n.delete(g.key)
                else n.add(g.key)
                return n
              })}
              aria-expanded={abierto}
              className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-muted/50"
            >
              <span className="flex min-w-0 items-center gap-2">
                {abierto
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className="truncate text-sm font-semibold">{g.label}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                {g.recorded} de {g.shots.length} grabadas
              </span>
            </button>

            {abierto && (
              <ul className="divide-y border-t">
                {g.shots.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <button
                      onClick={() => toggle(s)}
                      disabled={ocupado.has(s.id)}
                      aria-pressed={s.recorded}
                      aria-label={`${s.recorded ? 'Desmarcar' : 'Marcar'} ${s.title} como grabada`}
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition',
                        s.recorded
                          ? 'border-emerald-500 bg-emerald-500 text-black'
                          : 'border-border hover:border-emerald-500/50',
                      )}
                    >
                      {ocupado.has(s.id)
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : s.recorded && <Check className="h-4 w-4" aria-hidden="true" />}
                    </button>

                    <span className={cn('min-w-0 flex-1', s.recorded && 'opacity-50')}>
                      <span className={cn('block truncate text-[13px]', s.recorded && 'line-through')}>
                        {s.title}
                      </span>
                      {s.hook && <span className="block truncate text-[11px] text-muted-foreground">{s.hook}</span>}
                    </span>

                    {s.referenceUrl && (
                      <a
                        href={s.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Referencia de ${s.title}`}
                        className="shrink-0 rounded-md border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}

                    <select
                      value={s.shotType ?? ''}
                      onChange={(e) => cambiarTipo(s, e.target.value)}
                      aria-label={`Tipo de toma de ${s.title}`}
                      className="h-7 shrink-0 rounded-md border bg-background px-1.5 text-[11px] outline-none"
                    >
                      <option value="">Sin tipo</option>
                      {SHOT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>

                    <button
                      onClick={() => quitar(s)}
                      aria-label={`Quitar ${s.title} de la sesión`}
                      className="shrink-0 rounded-md border p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}

      {/* El total, al final: es lo que se mira para saber cuánto queda. */}
      <div className="sticky bottom-0 space-y-2 rounded-xl border bg-card/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-[12px]">
            <strong className="tabular-nums">{prog.recorded}</strong> de{' '}
            <strong className="tabular-nums">{prog.total}</strong> ideas grabadas
          </span>
          <span className={cn('text-[12px] tabular-nums', prog.pending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
            {prog.pending > 0 ? `Faltan ${prog.pending}` : 'Todo grabado'}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${prog.pct}%` }}
            role="progressbar"
            aria-valuenow={prog.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </div>
  )
}
