import { requirePermission, getCurrentRole } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { clientsForUser } from '@/lib/utils/client-visibility'
import { FiltroIPanel } from '@/components/filtro-i/filtro-i-panel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Filtro I — el área de envío de video, independiente de /revision y /entregas.
 *
 * No lee de ninguna de las dos ni escribe en sus tablas de estado: solo trae la
 * cartera de la persona para poblar el desplegable del formulario. El envío en
 * sí lo hace el mismo mecanismo de subida que ya existe (EditorSubmitSlot), sin
 * copiarlo ni modificarlo.
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

  // Solo los clientes que esta persona trabaja. Es filtro de conveniencia, no
  // control de acceso — ver la nota en client-visibility.ts.
  const misClientes = clientsForUser(
    role,
    user?.id ?? null,
    (activeClientsRaw ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      assigned_to: c.assigned_to ?? null,
      assigned_designer: c.assigned_designer ?? null,
    })),
  ).map((c) => ({ id: c.id, name: c.name }))

  return <FiltroIPanel clients={misClientes} />
}
