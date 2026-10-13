import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { requireVideoInventoryAccess } from '@/lib/auth/video-inventory-server'
import { getClientVideoInventory } from '@/lib/utils/load-client-video-inventory'
import { ClientVideoInventory } from '@/components/home/client-video-inventory'
import { PageHeader } from '@/components/shared/page-header'
import { PageSpinner } from '@/components/shared/page-spinner'
import { Card, CardContent } from '@/components/ui/card'

export default async function VideoInventoryPage() {
  await requireVideoInventoryAccess().catch(() => notFound())
  return <div className="space-y-6">
    <PageHeader title="Inventario de videos" description="Editados, crudos sin editar y programados pendientes de publicación." />
    <Suspense fallback={<div className="grid h-48 place-items-center rounded-xl border"><PageSpinner /></div>}>
      <InventoryData />
    </Suspense>
  </div>
}

async function InventoryData() {
  try {
    return <ClientVideoInventory {...await getClientVideoInventory()} />
  } catch {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No se pudo cargar el inventario de videos. Recarga para volver a consultar.</CardContent></Card>
  }
}
