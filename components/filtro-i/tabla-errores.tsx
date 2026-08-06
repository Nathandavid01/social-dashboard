import { CheckCircle2 } from 'lucide-react'
import type { ErrorDetectado } from '@/lib/llm/grok-vision-core'

/**
 * Lo que Grok encontró en los subtítulos del video.
 *
 * Es lo único que Filtro I le devuelve al editor. Se enseña tal cual, sin
 * ordenar ni agrupar: el orden en que sale es el orden del video, y así se
 * corrige de arriba abajo mientras se ve.
 */
export function TablaErrores({ errores }: { errores: ErrorDetectado[] }) {
  if (!errores.length) {
    return (
      <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2.5 text-[13px]">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        Sin errores. El video está limpio.
      </p>
    )
  }

  return (
    // La tabla scrollea dentro de su caja: en móvil una tabla de 4 columnas no
    // cabe, y sin esto se lleva la página entera al desbordarse.
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="whitespace-nowrap px-2.5 py-1.5 font-semibold">Dice</th>
            <th scope="col" className="whitespace-nowrap px-2.5 py-1.5 font-semibold">Debería decir</th>
            <th scope="col" className="whitespace-nowrap px-2.5 py-1.5 font-semibold">Tipo</th>
            <th scope="col" className="whitespace-nowrap px-2.5 py-1.5 font-semibold">Momento</th>
          </tr>
        </thead>
        <tbody>
          {errores.map((e, i) => (
            <tr key={i} className="border-t align-top">
              <td className="px-2.5 py-1.5 text-rose-600 line-through decoration-rose-600/40 dark:text-rose-400">
                {e.texto_incorrecto}
              </td>
              <td className="px-2.5 py-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                {e.correccion}
              </td>
              <td className="px-2.5 py-1.5 text-muted-foreground">{e.tipo}</td>
              <td className="whitespace-nowrap px-2.5 py-1.5 tabular-nums text-muted-foreground">
                {e.momento}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
