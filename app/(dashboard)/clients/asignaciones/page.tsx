import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { AssignmentsTable } from '@/components/clients/assignments-table'
import { ESTADOS_VIVOS } from '@/lib/clients/estado'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Reparto de clientes a editor y diseñador, todos en una pantalla.
 *
 * El formulario de cliente ya permite asignar uno a uno, pero repartir la
 * cartera entera por ahí son decenas de pantallas completas para tocar dos
 * campos.
 */
export default async function AsignacionesPage() {
  await requirePermission('clients.edit')
  const supabase = await createClient()

  const [{ data: clients }, { data: profiles }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, assigned_to, assigned_designer')
      .in('status', ESTADOS_VIVOS)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('status', 'active')
      .order('full_name'),
  ])

  return (
    <AssignmentsTable
      clients={(clients ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        assigned_to: c.assigned_to ?? null,
        assigned_designer: c.assigned_designer ?? null,
      }))}
      members={(profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name || p.email,
        role: p.role,
      }))}
    />
  )
}
