'use client'
import { useState } from 'react'
import { respondToIdeaProposal } from '@/lib/actions/idea-client-proposals'
import type { ProposalIdea, ClientDecision } from '@/lib/ideas/client-proposal'
import { ProposalPdfButton } from './proposal-pdf-button'
type Response = { idea_id: string; decision: string; comment: string }
export function ClientIdeaApproval({ token, clientName, date, ideas, responses }: {
  token: string; clientName: string; date: string; ideas: ProposalIdea[]; responses: Response[]
}) {
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 bg-white px-5 py-10 text-zinc-900">
    <header className="space-y-3"><p className="text-xs font-semibold tracking-widest text-amber-700">NATE MEDIA</p><h1 className="text-3xl font-semibold">Ideas para {clientName}</h1><p className="text-sm text-zinc-600">Revisa las {ideas.length} ideas, indica cuáles apruebas y envíanos tus comentarios. Cada respuesta se guarda al pulsar «Enviar respuesta».</p><ProposalPdfButton clientName={clientName} date={date} ideas={ideas} /></header>
    {ideas.map((idea, index) => <DecisionCard key={idea.id} token={token} idea={idea} number={index + 1} response={responses.find(r => r.idea_id === idea.id)} />)}
  </main>
}
function DecisionCard({ token, idea, number, response }: { token: string; idea: ProposalIdea; number: number; response?: Response }) {
  const [decision, setDecision] = useState<ClientDecision | ''>((response?.decision as ClientDecision) ?? '')
  const [comment, setComment] = useState(response?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(response ? 'Respuesta guardada' : '')
  async function submit() {
    setBusy(true); setMessage('')
    try {
      const result = await respondToIdeaProposal({ token, ideaId: idea.id, decision, comment })
      setMessage(result.error ?? 'Respuesta guardada. Gracias.')
    } catch { setMessage('No se pudo enviar. Intenta nuevamente.') }
    finally { setBusy(false) }
  }
  return <section className="space-y-4 rounded-xl border border-zinc-200 p-5">
    <h2 className="text-lg font-semibold">{number}. {idea.title}</h2>
    {idea.objective && <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950"><p className="font-semibold">Objetivo · Qué queremos lograr</p><p className="mt-0.5 whitespace-pre-wrap">{idea.objective}</p></div>}
    {idea.hook && <p className="whitespace-pre-wrap text-sm leading-relaxed">{idea.hook}</p>}
    {idea.visualBrief && <p className="whitespace-pre-wrap text-sm leading-relaxed">{idea.visualBrief}</p>}
    {idea.referenceUrl && /^https?:\/\//i.test(idea.referenceUrl) && <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">Ver referencia</a>}
    <fieldset disabled={busy} className="flex flex-wrap gap-5"><legend className="mb-2 text-sm font-medium">Tu decisión</legend>{(['approved', 'rejected'] as const).map(value => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name={`decision-${idea.id}`} value={value} checked={decision === value} onChange={() => { setDecision(value); setMessage('') }} />{value === 'approved' ? 'Aprobar' : 'No aprobar'}</label>)}</fieldset>
    <label className="block text-sm">Comentarios<textarea value={comment} maxLength={3000} disabled={busy} onChange={e => { setComment(e.target.value); setMessage('') }} className="mt-2 min-h-24 w-full rounded-lg border border-zinc-300 bg-white p-3" placeholder="Cuéntanos qué te gusta o qué debemos cambiar." /></label>
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={!decision || busy} onClick={() => void submit()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40">{busy ? 'Enviando…' : 'Enviar respuesta'}</button><p role="status" className="text-sm">{message}</p></div>
  </section>
}
