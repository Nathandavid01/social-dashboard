import { requirePermission, getCurrentRole } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { clientsForUser, visibleClientIds } from '@/lib/utils/client-visibility'
import { cargarAnalisisFiltroI } from '@/lib/filtro-i/consultas'
import { FiltroIPanel } from '@/components/filtro-i/filtro-i-panel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Filtro I — el editor entrega el video y recibe su tabla de errores.
 *
 * Independiente de /revision y /entregas: no lee ni escribe nada suyo. El
 * caption que sale del análisis NO se trae aquí (ver `cargarAnalisisFiltroI`);
 * vive en /grok-ing, con su propio permiso.
 */
export default async function FiltroIPage() {
  await requirePermission('filtro_i.read')
  const supabase = await createClient()

  const [{ data: activeClientsRaw }, role, { data: { user } }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, assigned_to, assigned_designer')
      .eq('status', 'active')
      .order('name'),
    getCurrentRole(),
    supabase.auth.getUser(),
  ])

  const asignables = (activeClientsRaw ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    assigned_to: c.assigned_to ?? null,
    assigned_designer: c.assigned_designer ?? null,
  }))

  // Solo los clientes que esta persona trabaja. Filtro de conveniencia, no
  // control de acceso — ver la nota en client-visibility.ts.
  const misClientes = clientsForUser(role, user?.id ?? null, asignables).map((c) => ({
    id: c.id,
    name: c.name,
  }))

  // Devuelve [] mientras la migración 0056 no esté aplicada, para que entregar
  // videos siga funcionando en vez de romper la página.
  const todos = await cargarAnalisisFiltroI(supabase)
  const permitidos = visibleClientIds(role, user?.id ?? null, asignables)
  const mios = permitidos === null ? todos : todos.filter((a) => permitidos.has(a.clientId ?? ''))

  return <FiltroIPanel clients={misClientes} analisis={mios} />
}
