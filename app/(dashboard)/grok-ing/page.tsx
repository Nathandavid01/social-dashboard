import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { cargarAnalisisGrokIng } from '@/lib/filtro-i/consultas'
import { GrokIngPanel } from '@/components/grok-ing/grok-ing-panel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Grok-ing — el caption que sale del análisis de Filtro I.
 *
 * Gate propio (`grok_ing.read`): el editor tiene `filtro_i.read` y NO llega
 * aquí. Esa separación es lo que hace que entregue el video sin ver el caption.
 *
 * Por ahora solo enseña el caption. La integración con Copy es lo siguiente.
 */
export default async function GrokIngPage() {
  await requirePermission('grok_ing.read')
  const supabase = await createClient()

  // [] mientras la migración 0056 no esté aplicada, en vez de romper la página.
  const analisis = await cargarAnalisisGrokIng(supabase)

  return <GrokIngPanel analisis={analisis} />
}
