import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ClientUploader } from '@/components/portal/client-uploader'
import { resolveClientId } from '@/lib/utils/client-slug-core'

export const dynamic = 'force-dynamic'

// Public magic-link page: the client opens /subir/<name-slug> (or the legacy
// /subir/<uuid>) and uploads raw footage straight into the team's pipeline.
// Read uses the service role so it works without any login.
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export default async function ClientUploadPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: ref } = await params
  const sb = admin()
  const { data } = await sb.from('clients').select('id, name, logo_url')
  const clients = (data ?? []) as { id: string; name: string; logo_url: string | null }[]

  const id = resolveClientId(ref, clients)
  const client = id ? clients.find((c) => c.id === id) : null
  if (!client) notFound()

  return <ClientUploader clientId={client.id} clientName={client.name} logoUrl={client.logo_url} />
}
