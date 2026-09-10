'use client'
import { getOnsiteShots } from '@/lib/actions/onsite'
import { getWrittenIdeas } from '@/lib/actions/ideas-batch'
import { useState } from 'react'
import { useToast } from '@/lib/hooks/use-toast'
import type { ProposalIdea } from '@/lib/ideas/client-proposal'
export function ProposalPdfButton({ clientName, date, ideas, sessionId, clientId }: { clientName: string; date: string; ideas: ProposalIdea[]; sessionId?: string; clientId?: string }) {
  const [busy, setBusy] = useState(false)
  const { toast } = useToast()
  async function download() {
    setBusy(true)
    try {
      let current = ideas
      if (sessionId) {
        const result = await getOnsiteShots(sessionId)
        if (result.error) throw new Error(result.error)
        current = result.shots ?? []
      } else if (clientId) {
        const result = await getWrittenIdeas(clientId)
        if (result.error) throw new Error(result.error)
        current = result.ideas ?? []
      }
      if (!current.length) throw new Error('No hay ideas para exportar')
      const { buildProposalPdf } = await import('@/lib/ideas/proposal-pdf')
      buildProposalPdf(clientName, date, current).save(`ideas-${clientName.trim().replace(/[^a-zA-Z0-9-]/g, '-')}-${date}.pdf`)
    } catch { toast({ title: 'No se pudo generar el PDF', variant: 'destructive' }) }
    finally { setBusy(false) }
  }
  return <button type="button" className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={busy || !ideas.length} onClick={() => void download()}>{busy ? 'Preparando PDF…' : 'Descargar PDF para aprobación'}</button>
}
