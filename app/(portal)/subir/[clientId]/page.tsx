import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ClientUploader } from '@/components/portal/client-uploader'

export const dynamic = 'force-dynamic'

// Public magic-link page: the client opens /subir/<their-client-id> and uploads
// raw footage straight into the team's pipeline. Read uses the service role so
// it works without any login (the id in the URL is the access token for now).
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export default async function ClientUploadPage({ params }: { params: { clientId: string } }) {
  const sb = admin()
  const { data: client } = await sb
    .from('clients')
    .select('id, name, logo_url')
    .eq('id', params.clientId)
    .maybeSingle()

  if (!client) notFound()

  return <ClientUploader clientId={client.id} clientName={client.name} logoUrl={client.logo_url} />
}
