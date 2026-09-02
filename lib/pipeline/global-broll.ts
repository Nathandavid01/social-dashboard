import type { ContentIdeaVideo } from '@/lib/supabase/types'
import type { PipelineBoardIdea } from '@/lib/pipeline/board-idea'

/**
 * Pool global de b-roll: recursos reutilizables que CUALQUIER editor puede ver
 * y bajar desde su banco, sin importar la asignación. Solo `kind: 'broll'` —
 * los crudos (raw) siguen scoped a la asignación y nunca entran aquí.
 *
 * PURO — sin imports de servidor.
 */

const LIVE = new Set<ContentIdeaVideo['status']>(['uploading', 'uploaded', 'processing'])

export interface GlobalBrollFile {
  id: string
  name: string
  storageProvider: ContentIdeaVideo['storage_provider']
  driveViewLink: string | null
}

export interface GlobalBrollGroup {
  clientId: string
  clientName: string
  files: GlobalBrollFile[]
}

export function buildGlobalBroll(ideas: PipelineBoardIdea[]): GlobalBrollGroup[] {
  const groups = new Map<string, GlobalBrollGroup>()

  for (const idea of ideas) {
    if (idea.status === 'descartada') continue
    const clientId = idea.client?.id ?? idea.client_id ?? null
    if (!clientId) continue

    const broll = (idea.videos ?? []).filter((v) => v.kind === 'broll' && LIVE.has(v.status))
    if (broll.length === 0) continue

    let group = groups.get(clientId)
    if (!group) {
      group = { clientId, clientName: idea.client?.name ?? 'Cliente', files: [] }
      groups.set(clientId, group)
    }
    for (const v of broll) {
      group.files.push({
        id: v.id,
        name: v.name?.trim() || 'b-roll.mp4',
        storageProvider: v.storage_provider,
        driveViewLink: v.drive_view_link ?? null,
      })
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.clientName.localeCompare(b.clientName))
}
