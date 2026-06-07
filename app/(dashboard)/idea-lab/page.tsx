import { requirePermission } from '@/lib/auth/server'
import { getClients } from '@/lib/actions/clients'
import { PageHeader } from '@/components/shared/page-header'
import { IdeaLab } from '@/components/ideas/idea-lab'
import type { Client } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function IdeaLabPage() {
  await requirePermission('ideas.edit')

  const clients = (await getClients()) as unknown as Client[]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Laboratorio de Ideas"
        description="Genera ideas de contenido con IA — reels, posts y carruseles — apoyándote en las tendencias actuales de redes."
      />
      <IdeaLab clients={clients} />
    </div>
  )
}
