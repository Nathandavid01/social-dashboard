import { requirePermission } from '@/lib/auth/server'
import { canScheduleFromPool, getClientPoolPanel } from '@/lib/actions/client-pool'
import { ClientPoolPanelView } from '@/components/pool/client-pool-panel'
import { PoolPublicadoAutoSync } from '@/components/pool/pool-publicado-auto-sync'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Panel clientes: pool Listo (Recibo AI aprobado) + calendario
 * agendado/publicado. El drag crea un borrador en Metricool.
 */
export default async function PoolPage() {
  await requirePermission('posting.read')
  const [panel, canSchedule] = await Promise.all([
    getClientPoolPanel(),
    canScheduleFromPool(),
  ])
  if (panel.error || !panel.data) {
    return (
      <p className="text-sm text-muted-foreground">
        {panel.error ?? 'No se pudo cargar el panel.'}
      </p>
    )
  }
  return (
    <>
      <PoolPublicadoAutoSync />
      <ClientPoolPanelView data={panel.data} canSchedule={canSchedule} />
    </>
  )
}
