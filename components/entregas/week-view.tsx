'use client'

import { CalendarDays, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiaDeSemana } from '@/lib/entregas/semana'
import type { DiaKey } from '@/lib/entregas/dias'

/**
 * Cómo viene la semana, para poder planificar sin ir pestaña por pestaña.
 *
 * Cada columna es un día de PUBLICACIÓN y dice cuándo hay que tener listo lo
 * que sale ahí — mismo criterio que las pestañas, para que las dos vistas no
 * discrepen. Pulsar una columna abre ese día en la vista de tablero.
 */
export function WeekView({
  semana,
  hoy,
  onAbrirDia,
}: {
  semana: DiaDeSemana[]
  /** Día de hoy, para resaltar la columna. null si hoy es domingo. */
  hoy?: DiaKey | null
  onAbrirDia: (dia: DiaKey) => void
}) {
  const totalSemana = semana.reduce((n, d) => n + d.total, 0)

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">Tu semana</span>
        </h2>
        <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
          {totalSemana} video{totalSemana === 1 ? '' : 's'} esta semana
        </span>
      </div>

      {/* Scroll horizontal propio: seis columnas no caben en un móvil, y la
          página entera no debe desplazarse de lado por esto. */}
      <div className="overflow-x-auto pb-1">
        <ul className="grid min-w-[720px] grid-cols-6 gap-2">
          {semana.map((d) => (
            <li key={d.dia}>
              <button
                type="button"
                onClick={() => onAbrirDia(d.dia)}
                aria-label={`Abrir ${d.label}: ${d.total} video${d.total === 1 ? '' : 's'}`}
                className={cn(
                  'flex h-full w-full flex-col gap-1.5 rounded-xl border p-2.5 text-left transition',
                  'hover:border-foreground/20 hover:bg-muted',
                  hoy === d.dia ? 'border-primary/50 bg-primary/5' : 'border-border bg-card',
                )}
              >
                <div className="flex items-baseline justify-between gap-1.5">
                  <span className="truncate text-[12px] font-semibold">{d.label}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                      d.total > 0 ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60',
                    )}
                  >
                    {d.total}
                  </span>
                </div>

                {/* Lo que más se olvida: que lo del martes hay que tenerlo el lunes. */}
                <p className="flex items-center gap-0.5 whitespace-nowrap text-[9.5px] text-muted-foreground">
                  listo <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" /> {d.diaListo}
                </p>

                {d.clientes.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/60">Nada</p>
                ) : (
                  <ul className="space-y-0.5">
                    {d.clientes.slice(0, 4).map((c) => (
                      <li key={c.id} className="flex items-baseline justify-between gap-1 text-[10.5px]">
                        <span className="truncate">{c.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{c.videos}</span>
                      </li>
                    ))}
                    {d.clientes.length > 4 && (
                      <li className="text-[10px] text-muted-foreground/70">
                        +{d.clientes.length - 4} más
                      </li>
                    )}
                  </ul>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
