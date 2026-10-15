import { requirePermission } from '@/lib/auth/server'
import { loadVideoStock } from '@/lib/inventario/load-video-stock'
import { PageHeader } from '@/components/shared/page-header'
import { VideoStockView } from '@/components/inventario/video-stock-view'

export const dynamic = 'force-dynamic'

export default async function InventarioPage() {
  await requirePermission('video_stock.read')
  const stock = await loadVideoStock()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario de video"
        description="Qué clientes tienen grabaciones por editar y cuántos videos editados les quedan antes de quedarse sin contenido."
      />
      {stock ? (
        <VideoStockView stock={stock} />
      ) : (
        // Failing loud: zeros here would read as "everyone is out of videos".
        <p className="rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          No se pudo leer el inventario. Recarga la página — no asumas que los clientes están sin videos.
        </p>
      )}
    </div>
  )
}
