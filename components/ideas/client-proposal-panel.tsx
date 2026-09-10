'use client'
import { useEffect, useState } from 'react'
import { createIdeaClientProposal, listIdeaClientProposals, revokeIdeaClientProposal } from '@/lib/actions/idea-client-proposals'
import type { ProposalIdea } from '@/lib/ideas/client-proposal'
export function ClientProposalPanel({ sessionId }: { sessionId: string }) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [proposals, setProposals] = useState<NonNullable<Awaited<ReturnType<typeof listIdeaClientProposals>>['proposals']>>([])
  async function refresh() {
    try {
      const result = await listIdeaClientProposals(sessionId)
      setProposals(result.proposals ?? [])
      setMessage(result.error ?? '')
    } catch { setMessage('No se pudieron cargar las respuestas. Intenta nuevamente.') }
  }
  useEffect(() => { setLink(''); setMessage(''); void refresh() }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps
  async function create() {
    setBusy(true); setMessage('')
    try {
      const result = await createIdeaClientProposal(sessionId)
      if (result.error) setMessage(result.error)
      else if (result.path) { setLink(new URL(result.path, window.location.origin).href); await refresh() }
    } catch { setMessage('No se pudo crear el enlace. Intenta nuevamente.') }
    finally { setBusy(false) }
  }
  async function revoke(id: string) {
    setBusy(true)
    try {
      const result = await revokeIdeaClientProposal(sessionId, id)
      if (result.error) setMessage(result.error)
      else { setLink(''); await refresh() }
    } catch { setMessage('No se pudo desactivar el enlace.') }
    finally { setBusy(false) }
  }
  return <section className="space-y-4 rounded-xl border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Aprobación del cliente</h2><p className="text-sm text-muted-foreground">Comparte una copia de las ideas con PDF. El cliente responde por idea. El enlace dura 30 días.</p></div><button type="button" onClick={() => void create()} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? 'Procesando…' : 'Crear enlace para aprobación'}</button></div>
    {link && <div className="flex flex-wrap gap-2"><input aria-label="Enlace para el cliente" readOnly value={link} className="min-w-0 flex-1 rounded-lg border bg-background p-2 text-sm" /><button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => { void navigator.clipboard.writeText(link).then(() => setMessage('Enlace copiado')).catch(() => setMessage('Selecciona y copia el enlace.')) }}>Copiar enlace</button><a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg border px-3 py-2 text-sm">Abrir propuesta</a></div>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    <button type="button" className="text-sm underline" onClick={() => void refresh()}>Actualizar respuestas</button>
    {proposals.map(proposal => <details key={proposal.id} className="rounded-lg border p-3"><summary className="cursor-pointer text-sm">Propuesta del {new Date(proposal.created_at).toLocaleString('es-PR')} · {proposal.responses.length} de {(proposal.ideas as ProposalIdea[]).length} respuestas{proposal.revoked_at ? ' · Enlace desactivado' : ''}</summary><div className="mt-3 space-y-3">
      {(proposal.ideas as ProposalIdea[]).map(idea => { const response = proposal.responses.find(r => r.idea_id === idea.id); return <div key={idea.id} className="rounded border p-3 text-sm"><p className="font-medium">{idea.title} · {response?.decision === 'approved' ? 'Aprobada' : response?.decision === 'rejected' ? 'No aprobada' : 'Pendiente'}</p>{response?.comment && <p className="mt-1 whitespace-pre-wrap">{response.comment}</p>}</div> })}
      {!proposal.revoked_at && <button type="button" disabled={busy} onClick={() => void revoke(proposal.id)} className="text-sm underline">Desactivar enlace</button>}
    </div></details>)}
  </section>
}
