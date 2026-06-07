'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { maybeAutoPostIdea } from '@/lib/actions/idea-posting'
import type { IdeaApprovalStatus } from '@/lib/supabase/types'

type Result = { ok?: true; error?: string }

/**
 * Valid approval transitions (design spec §4):
 *   pending          → submitted
 *   submitted        → approved
 *   submitted        → revision_needed
 *   revision_needed  → submitted
 * Anything else is rejected.
 */
const VALID_TRANSITIONS: Record<IdeaApprovalStatus, IdeaApprovalStatus[]> = {
  pending: ['submitted'],
  submitted: ['approved', 'revision_needed'],
  revision_needed: ['submitted'],
  approved: [],
}

function canTransition(from: IdeaApprovalStatus | null, to: IdeaApprovalStatus): boolean {
  const current = from ?? 'pending'
  return (VALID_TRANSITIONS[current] ?? []).includes(to)
}

function revalidate(ideaId: string) {
  revalidatePath(`/produccion/idea/${ideaId}`)
  revalidatePath('/video-reviews')
}

/**
 * Shared skeleton for every approval action: gate on `video.approve`, read the
 * current status, validate the transition, then apply `payload`. Each public
 * action only supplies its target status, update payload, and deny message.
 */
async function transition(
  ideaId: string,
  to: IdeaApprovalStatus,
  payload: Record<string, unknown>,
  denyMessage: (current: IdeaApprovalStatus) => string,
): Promise<Result> {
  try {
    await requirePermission('video.approve')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()

  const { data: idea, error: readErr } = await supabase
    .from('content_ideas')
    .select('id, approval_status')
    .eq('id', ideaId)
    .single()
  if (readErr) return { error: readErr.message }
  if (!idea) return { error: 'Idea no encontrada' }

  const current = (idea.approval_status ?? 'pending') as IdeaApprovalStatus
  if (!canTransition(current, to)) return { error: denyMessage(current) }

  const { error: updErr } = await supabase
    .from('content_ideas')
    .update({ approval_status: to, ...payload })
    .eq('id', ideaId)
  if (updErr) return { error: updErr.message }

  revalidate(ideaId)
  return { ok: true }
}

/** Move an idea into review: pending|revision_needed -> submitted. */
export async function submitIdeaForApproval(ideaId: string): Promise<Result> {
  return transition(
    ideaId,
    'submitted',
    { submitted_at: new Date().toISOString() },
    (current) => `No se puede enviar a revisión desde el estado "${current}".`,
  )
}

/** Approve an idea: submitted -> approved (stamps approver + timestamp). */
export async function approveIdea(ideaId: string): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const res = await transition(
    ideaId,
    'approved',
    { approved_by: user?.id ?? null, approved_at: new Date().toISOString() },
    (current) => `Solo se puede aprobar una idea en revisión (estado actual: "${current}").`,
  )
  // A fully-ready idea (caption + edited video) auto-posts to Metricool on its
  // planned date. Best-effort — never blocks or fails the approval.
  if (res.ok) await maybeAutoPostIdea(ideaId)
  return res
}

/** Request changes: submitted -> revision_needed. */
export async function requestRevision(ideaId: string, _notes?: string): Promise<Result> {
  return transition(
    ideaId,
    'revision_needed',
    {},
    (current) => `Solo se pueden pedir cambios sobre una idea en revisión (estado actual: "${current}").`,
  )
}
