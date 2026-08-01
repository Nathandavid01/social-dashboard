import { redirect } from 'next/navigation'
import { getMyDay } from '@/lib/actions/my-day'
import { getPendientes } from '@/lib/actions/mi-dia-pendientes'
import { PendientesResumen } from '@/components/my-day/pendientes-resumen'

/**
 * "Mi día" — la primera pantalla. Cada rol tiene la suya: ¿qué me toca hoy?
 *
 * Antes enseñaba la lista entera de trabajo libre del equipo: 34 videos, 32
 * atrasados de hace un mes, todos con "graba el video". Eso es un backlog, no
 * un día de trabajo, y una lista de 32 filas no se lee. Ahora: los números que
 * te tocan a ti, y cada uno lleva a donde se resuelve.
 *
 * Sin permiso a propósito: esto es el trabajo propio de cada quien, no hay nada
 * que autorizar. getPendientes filtra por rol y por clientes asignados.
 */
export const dynamic = 'force-dynamic'

export default async function MiDiaPage() {
  const result = await getMyDay()
  if (!result) redirect('/login')

  const pendientes = await getPendientes()

  return (
    <div className="space-y-6">
      <PendientesResumen pendientes={pendientes} nombre={result.firstName} />
    </div>
  )
}
