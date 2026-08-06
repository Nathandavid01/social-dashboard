'use client'

import { Filter } from 'lucide-react'
import { EditorSubmitSlot } from '@/components/pipeline/editor-submit-slot'

/**
 * Filtro I — enviar el video, y nada más.
 *
 * Área aparte de Revisión y Entregas por decisión de producto: no comparte
 * ruta, ni permiso, ni componentes con ellas. Reutiliza `EditorSubmitSlot`
 * (que vive en components/pipeline y es el mecanismo de subida, no una
 * pantalla), pero no importa nada de components/entregas — así tocar Filtro I
 * no puede romper el flujo del editor, ni al revés.
 *
 * Deliberadamente NO trae el tablero por etapas ni la lista de devueltos: eso
 * es el trabajo de Revisión, y duplicarlo aquí crearía dos sitios donde mirar
 * lo mismo.
 */
export function FiltroIPanel({
  clients,
}: {
  clients: { id: string; name: string }[]
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
              Sube el video y dinos para cuándo es.
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
        // `dia` ya no decide nada — cada video lleva su propia fecha —, pero el
        // slot sigue pidiéndolo por firma.
        <EditorSubmitSlot clients={clients} dia={1} />
      )}
    </div>
  )
}
