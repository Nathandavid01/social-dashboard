'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { RateIdeaInput, ApprovedIdea, IdeaFeedbackExamples } from './idea-feedback-types'

/**
 * Approve (✓) or reject (✗) a generated idea. Approved ideas surface in
 * "Ideas Aprobadas" for editors/designers; both verdicts feed the learning loop.
 * Gated to the marketing team (ideas.edit).
 */
export async function rateIdea(input: RateIdeaInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requirePermission('ideas.edit')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('idea_lab_feedback')
    .insert({
      client_id: input.clientId ?? null,
      verdict: input.verdict,
      content_type: input.contentType,
      objective: input.objective ?? null,
      funnel_stage: input.funnelStage ?? null,
      title: input.title,
      hook: input.hook ?? null,
      visual_brief: input.visualBrief ?? null,
      caption_angle: input.captionAngle ?? null,
      hashtags_suggestion: input.hashtagsSuggestion ?? null,
      rationale: input.rationale ?? null,
      theme: input.theme ?? null,
      trends: input.trends ?? [],
      rated_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/ideas-aprobadas')
  return { ok: true, id: data.id }
}

/** Approved ideas, newest first, for the "Ideas Aprobadas" view. */
export async function getApprovedIdeas(limit = 100): Promise<ApprovedIdea[]> {
  await requirePermission('ideas.read')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('idea_lab_feedback')
    .select('*, client:clients!idea_lab_feedback_client_id_fkey(id, name)')
    .eq('verdict', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ApprovedIdea[]
}

/**
 * Recent approvals/rejections for the generation prompt (learning loop).
 * Defensive: returns empty on any error (e.g. before the 0033 migration is
 * applied) so idea generation keeps working regardless.
 */
export async function getIdeaFeedbackForPrompt(clientId?: string | null): Promise<IdeaFeedbackExamples> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('idea_lab_feedback')
      .select('verdict, title, hook, client_id')
      .order('created_at', { ascending: false })
      .limit(60)

    if (error || !data) return { approved: [], rejected: [] }

    // Prefer this client's taste (plus general), else fall back to everything.
    const rows = clientId ? data.filter((r) => r.client_id === clientId || r.client_id === null) : data
    const label = (r: { title: string; hook: string | null }) => (r.hook ? `${r.title} — ${r.hook}` : r.title)
    const approved = rows.filter((r) => r.verdict === 'approved').slice(0, 10).map(label)
    const rejected = rows.filter((r) => r.verdict === 'rejected').slice(0, 10).map(label)
    return { approved, rejected }
  } catch {
    return { approved: [], rejected: [] }
  }
}
