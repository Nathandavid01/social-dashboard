import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { GraphicGenerator } from '@/components/graficas/graphic-generator'
import type { GeneratedGraphicRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function GraficasPage() {
  await requirePermission('graphics.generate')
  const supabase = await createClient()

  const [{ data: clients }, historyRes] = await Promise.all([
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase
      .from('generated_graphics')
      .select('id, client_id, concept, aspect_ratio, model, image_url, created_at, client:clients(name)')
      .order('created_at', { ascending: false })
      .limit(24),
  ])

  // Until migration 0072 is applied the table doesn't exist — the page still
  // works, just without history.
  const history = (historyRes.error ? [] : (historyRes.data ?? [])) as unknown as GeneratedGraphicRow[]

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Gráficas</h1>
        <p className="text-sm text-muted-foreground">
          Genera artes para las redes del cliente con IA (Grok Imagine), usando sus colores y voz de marca.
        </p>
      </div>
      <GraphicGenerator clients={clients ?? []} history={history} />
    </div>
  )
}
