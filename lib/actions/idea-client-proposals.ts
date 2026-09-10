'use server'
import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOnsiteShots } from './onsite'
import { proposalSnapshot, validateDecision, type ProposalIdea } from '@/lib/ideas/client-proposal'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
async function visibleSession(sessionId: string) {
  await requirePermission('ideas.share')
  const db = await createClient()
  const { data, error } = await db.from('recording_sessions')
    .select('id, client_id, session_date, client:clients(name)').eq('id', sessionId).single()
  if (error || !data?.client_id) throw new Error('Grabación no disponible')
  return data
}
export async function createIdeaClientProposal(sessionId: string) {
  try {
    const session = await visibleSession(sessionId)
    const { shots, error } = await getOnsiteShots(sessionId)
    if (error) return { error }
    if (!shots?.length) return { error: 'No hay ideas para enviar.' }
    const db = createAdminClient()
    if (!db) return { error: 'Falta configurar el portal de aprobación.' }
    const auth = await createClient()
    const { data: { user } } = await auth.auth.getUser()
    const token = randomBytes(32).toString('hex')
    const raw = session.client as unknown as { name: string } | { name: string }[]
    const client = Array.isArray(raw) ? raw[0] : raw
    const { error: insertError } = await db.from('idea_client_proposals').insert({
      session_id: sessionId, client_id: session.client_id, client_name: client?.name ?? 'Cliente',
      session_date: session.session_date, ideas: proposalSnapshot(shots), token_hash: hash(token),
      created_by: user?.id, expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    if (insertError) return { error: 'No se pudo crear la propuesta. Verifica que la migración del portal esté aplicada.' }
    revalidatePath('/onsite')
    return { path: `/aprobar-ideas/${token}` }
  } catch (error) { return { error: error instanceof Error ? error.message : 'No se pudo crear el enlace.' } }
}
async function findProposal(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  const db = createAdminClient()
  if (!db) return null
  const { data, error } = await db.from('idea_client_proposals')
    .select('id, client_name, session_date, ideas, created_at, expires_at')
    .eq('token_hash', hash(token)).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
  return error ? null : data
}
export async function readIdeaClientProposal(token: string) {
  const proposal = await findProposal(token)
  if (!proposal) return null
  const db = createAdminClient()!
  const { data, error } = await db.from('idea_client_responses').select('idea_id, decision, comment, responded_at').eq('proposal_id', proposal.id)
  if (error) return null
  return { ...proposal, ideas: proposal.ideas as ProposalIdea[], responses: data ?? [] }
}
export async function respondToIdeaProposal(input: { token: string; ideaId: string; decision: string; comment: string }) {
  if (!validateDecision(input.decision, input.comment)) return { error: 'Selecciona aprobar o no aprobar; máximo 3000 caracteres.' }
  const proposal = await findProposal(input.token)
  if (!proposal || !(proposal.ideas as ProposalIdea[]).some(idea => idea.id === input.ideaId)) return { error: 'El enlace no está disponible o la idea no pertenece a esta propuesta.' }
  const { error } = await createAdminClient()!.from('idea_client_responses').upsert({
    proposal_id: proposal.id, idea_id: input.ideaId, decision: input.decision,
    comment: input.comment.trim(), responded_at: new Date().toISOString(),
  }, { onConflict: 'proposal_id,idea_id' })
  if (error) return { error: 'No se pudo guardar la respuesta. Intenta nuevamente.' }
  revalidatePath('/onsite')
  return { ok: true }
}
export async function listIdeaClientProposals(sessionId: string) {
  try {
    await visibleSession(sessionId)
    const db = createAdminClient()
    if (!db) return { error: 'Portal de aprobación no configurado.' }
    const { data, error } = await db.from('idea_client_proposals')
      .select('id, ideas, created_at, expires_at, revoked_at, responses:idea_client_responses(idea_id, decision, comment, responded_at)')
      .eq('session_id', sessionId).order('created_at', { ascending: false }).limit(20)
    if (error) return { error: 'Portal pendiente de configuración de base de datos.' }
    return { proposals: data ?? [] }
  } catch { return { error: 'No autorizado' } }
}
export async function revokeIdeaClientProposal(sessionId: string, proposalId: string) {
  try {
    await visibleSession(sessionId)
    const db = createAdminClient()
    if (!db) return { error: 'Portal no configurado.' }
    const { error } = await db.from('idea_client_proposals').update({ revoked_at: new Date().toISOString() })
      .eq('id', proposalId).eq('session_id', sessionId)
    if (error) return { error: 'No se pudo desactivar el enlace.' }
    revalidatePath('/onsite')
    return { ok: true }
  } catch { return { error: 'No autorizado' } }
}
