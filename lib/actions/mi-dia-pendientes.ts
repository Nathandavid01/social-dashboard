import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRole } from '@/lib/auth/server'
import { visibleClientIds } from '@/lib/utils/client-visibility'
import { pendientesPara, type DatosPendientes, type Pendiente } from '@/lib/my-day/pendientes'

/**
 * Los números de "lo que tengo que hacer", ya filtrados por rol.
 *
 * Cuenta solo videos del flujo de Entregas —los que tienen archivo en su bucket—
 * y solo de los clientes que esa persona trabaja: un editor no debe ver como
 * pendiente el retrabajo de otro.
 */
export async function getPendientes(): Promise<Pendiente[]> {
  const supabase = await createClient()
  const [role, { data: { user } }] = await Promise.all([getCurrentRole(), supabase.auth.getUser()])
  if (!role || !user) return []

  const [{ data: clients }, { data: ideas }] = await Promise.all([
    supabase.from('clients').select('id, name, assigned_to, assigned_designer').eq('status', 'active'),
    supabase
      .from('content_ideas')
      .select('id, client_id, approval_status, generated_caption, status, videos:content_idea_videos(kind, storage_provider)')
      .neq('status', 'descartada')
      .limit(3000),
  ])

  const permitidos = visibleClientIds(role, user.id, (clients ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    assigned_to: (c.assigned_to as string | null) ?? null,
    assigned_designer: (c.assigned_designer as string | null) ?? null,
  })))

  const mios = (ideas ?? []).filter((i) => {
    // Solo lo entregado por este flujo: sin esto contaría ideas históricas que
    // nunca pasaron por aquí y el número no significaría nada.
    const esDeEntregas = ((i.videos ?? []) as { kind: string; storage_provider: string }[])
      .some((v) => v.kind === 'edited' && v.storage_provider === 'entregas-r2')
    if (!esDeEntregas) return false
    return permitidos === null || permitidos.has((i.client_id as string) ?? '')
  })

  const conCaption = (i: (typeof mios)[number]) =>
    typeof i.generated_caption === 'string' && i.generated_caption.trim().length > 0

  const hoy = new Date().toISOString().slice(0, 10)
  const [{ count: grabaciones }, { count: sinGrabar }] = await Promise.all([
    supabase.from('recording_sessions').select('*', { count: 'exact', head: true })
      .gte('session_date', hoy).neq('status', 'cancelled'),
    supabase.from('content_ideas').select('*', { count: 'exact', head: true }).eq('status', 'idea'),
  ])

  const datos: DatosPendientes = {
    porRevisar: mios.filter((i) => i.approval_status === 'submitted').length,
    devueltos: mios.filter((i) => i.approval_status === 'revision_needed').length,
    esperandoCopy: mios.filter((i) => i.approval_status === 'approved' && !conCaption(i)).length,
    listosMetricool: mios.filter((i) => i.approval_status === 'approved' && conCaption(i)).length,
    grabacionesProximas: grabaciones ?? 0,
    ideasSinGrabar: sinGrabar ?? 0,
  }

  return pendientesPara(role, datos)
}
