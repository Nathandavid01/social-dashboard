'use client'

import { Filter } from 'lucide-react'
import { EntregarVideo } from './entregar-video'
import { AnalisisCard, type AnalisisResumen } from './analisis-card'

/**
 * Filtro I — entregar el video y ver qué encontró la revisión automática.
 *
 * Área aparte de Revisión y Entregas: no comparte ruta, ni permiso, ni
 * componentes con ellas. Lo que reutiliza (`SubmitVideoCard`, la cadena de
 * subida) vive en components/pipeline y lib/, no en components/entregas.
 *
 * Deliberadamente NO enseña el caption. El editor entrega y recibe su tabla de
 * errores; el caption vive en Grok-ing, que es otra área y otro permiso.
 */
export function FiltroIPanel({
  clients,
  analisis,
}: {
  clients: { id: string; name: string }[]
  analisis: AnalisisResumen[]
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-black">
            <Filter className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">Filtro I</h1>
            <p className="truncate text-xs text-muted-foreground">
              Sube el video y te decimos qué corregir.
            </p>
          </div>
        </div>
      </header>

      {clients.length === 0 ? (
        // Un desplegable de clientes vacío parece un fallo de carga. Decir por
        // qué está vacío ahorra el "no me deja subir nada".
        <p className="rounded-xl border border-dashed p-4 text-[13px] text-muted-foreground">
          No tienes clientes asignados, así que no hay a quién entregarle todavía.
          Pídele a tu supervisor que te asigne uno.
        </p>
      ) : (
        <EntregarVideo clients={clients} />
      )}

      {analisis.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-semibold">Lo que has entregado</h2>
          <ul className="space-y-2">
            {analisis.map((a) => (
              <AnalisisCard key={a.id} analisis={a} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
