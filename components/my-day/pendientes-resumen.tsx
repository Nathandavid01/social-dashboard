import Link from 'next/link'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Pendiente } from '@/lib/my-day/pendientes'

/**
 * "Tienes X por hacer", de un vistazo y según el rol.
 *
 * Reemplaza la lista completa de trabajo libre del equipo que había antes: 34
 * videos, 32 atrasados de hace un mes. Una lista de 32 filas no se lee, se
 * ignora — así que aquí van números grandes que llevan al sitio, y nada más.
 */
export function PendientesResumen({
  pendientes,
  nombre,
}: {
  pendientes: Pendiente[]
  nombre?: string | null
}) {
  const saludo = nombre ? `Hola, ${nombre}` : 'Hola'

  if (pendientes.length === 0) {
    return (
      <section className="space-y-1">
        <p className="text-sm text-muted-foreground">{saludo}</p>
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">No tienes nada pendiente</p>
            <p className="text-xs text-muted-foreground">
              Cuando algo necesite tu turno, aparecerá aquí.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const total = pendientes.reduce((n, p) => n + p.count, 0)

  return (
    <section className="space-y-2">
      <p className="text-sm text-muted-foreground">{saludo}</p>
      <h1 className="text-xl font-bold tracking-tight">
        Tienes {total} cosa{total === 1 ? '' : 's'} por hacer
      </h1>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pendientes.map((p) => (
          <li key={p.key}>
            <Link
              href={p.href}
              className={cn(
                'group flex h-full items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm',
                p.tone === 'urgente'
                  ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
                  : 'border-border bg-card hover:border-foreground/20',
              )}
            >
              <span
                className={cn(
                  'shrink-0 text-2xl font-bold tabular-nums leading-none',
                  p.tone === 'urgente' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
                )}
              >
                {p.count}
              </span>
              <span className="min-w-0 flex-1 text-[12px] leading-snug text-muted-foreground">
                {p.label}
              </span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
