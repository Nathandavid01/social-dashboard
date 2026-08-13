'use server'

import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import {
  reviewLinkUrl,
  defaultExpiryISO,
  type ReviewComment,
  type ClientReviewStatus,
} from '@/lib/utils/review-link-core'

export type StaffReviewView = {
  review_token: string | null
  review_token_expires_at: string | null
  client_review_status: ClientReviewStatus
  client_reviewer_name: string | null
  client_reviewed_at: string | null
  comments: ReviewComment[]
}

/** Best-effort public origin for the review link (request host → env → prod). */
async function resolveBaseUrl(): Promise<string> {
  // Prefer the explicit site URL: this link is pasted to external clients, so a
  // preview/alternate domain (or a spoofed x-forwarded-host) must never leak in.
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    if (host) return `${proto}://${host}`
  } catch {
    // headers() unavailable (e.g. tests) — fall through
  }
  return 'https://social-dashboard-zeta-orpin.vercel.app'
}

/**
 * Mint (or re-mint) the client review link for a video and return its full URL
 * for the staff to copy into WhatsApp. Gated on `posting.publish` (external-
 * facing) and on the edited video existing — that's what the client watches.
 * The token is a CSPRNG uuid (crypto.randomUUID); re-minting invalidates the
 * old link. Degrades to a clean error if migration 0042 isn't applied.
 */
export async function generateReviewLink(
  ideaId: string,
): Promise<{ url?: string; expiresAt?: string; error?: string }> {
  try {
    await requirePermission('posting.publish')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()

  const { data: edited } = await supabase
    .from('content_idea_videos')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .eq('storage_provider', 'r2')
    .neq('status', 'archived')
    .order('uploaded_at', { ascending: false })
    .limit(1)
  if (!edited || edited.length === 0) {
    return { error: 'Este enlace es del pipeline. El corte de Entregas se aprueba con el enlace de la tarjeta, no aquí.' }
  }

  // Sending the link IS submitting the video for review. This has to be recorded:
  // the client's vote only drives the pipeline for a video the staff actually
  // sent out (see `decideClientVote`), so a token minted on a `pending` video
  // would produce a vote that does nothing. An already-`approved` video keeps its
  // status — re-sending a link must not reopen it.
  const { data: current } = await supabase
    .from('content_ideas')
    .select('approval_status')
    .eq('id', ideaId)
    .single()
  const submitting = (current?.approval_status ?? 'pending') !== 'approved'

  const token = randomUUID()
  const expiresAt = defaultExpiryISO(new Date().toISOString(), 30)
  const { error } = await supabase
    .from('content_ideas')
    .update({
      review_token: token,
      review_token_expires_at: expiresAt,
      // A new link is a NEW ask, so the old vote must not ride along: it belonged
      // to the old link. Leaving it would make the re-send inert — the client
      // would open the fresh link, see their stale "✓ Aprobado", get no buttons,
      // and no decision could ever come back. Only reset when we're actually
      // re-submitting (an already-approved video keeps its state untouched).
      ...(submitting
        ? {
            approval_status: 'submitted',
            submitted_at: new Date().toISOString(),
            client_review_status: 'pending',
            client_reviewed_at: null,
          }
        : {}),
    })
    .eq('id', ideaId)
  if (error) return { error: 'No se pudo generar el link (¿migración 0042 aplicada?).' }

  if (submitting) {
    const { data: { user } } = await supabase.auth.getUser()
    await logIdeaActivity(supabase, {
      ideaId,
      userId: user?.id ?? null,
      action: 'sent_to_client',
      metadata: { expiresAt },
    })
  }

  revalidatePath('/clients')
  revalidatePath('/video-reviews')
  return { url: reviewLinkUrl(await resolveBaseUrl(), token), expiresAt }
}

/** Read the client's decision + comment thread for the staff card. Null on error
 * (e.g. before 0042 is applied) so the card degrades instead of crashing. */
export async function getReviewStaffView(ideaId: string): Promise<StaffReviewView | null> {
  try {
    await requirePermission('planning.move')
  } catch {
    return null
  }

  const supabase = await createClient()
  const { data: idea, error } = await supabase
    .from('content_ideas')
    .select(
      'review_token, review_token_expires_at, client_review_status, client_reviewer_name, client_reviewed_at',
    )
    .eq('id', ideaId)
    .single()
  if (error || !idea) return null

  const { data: comments } = await supabase
    .from('video_review_comments')
    .select('id, author_kind, author_name, body, created_at')
    .eq('content_idea_id', ideaId)
    .order('created_at', { ascending: true })

  return {
    review_token: (idea as StaffReviewView).review_token ?? null,
    review_token_expires_at: (idea as StaffReviewView).review_token_expires_at ?? null,
    client_review_status: (idea as StaffReviewView).client_review_status ?? 'pending',
    client_reviewer_name: (idea as StaffReviewView).client_reviewer_name ?? null,
    client_reviewed_at: (idea as StaffReviewView).client_reviewed_at ?? null,
    comments: (comments as ReviewComment[]) ?? [],
  }
}

/** Staff reply to the client's review thread (author_kind='staff'). */
export async function addStaffReviewComment(
  ideaId: string,
  body: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('planning.move')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!body || body.trim().length === 0) return { error: 'Escribe un comentario.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { error } = await supabase.from('video_review_comments').insert({
    content_idea_id: ideaId,
    author_kind: 'staff',
    author_id: user.id,
    author_name: profile?.full_name?.trim() || 'Equipo',
    body: body.trim(),
  })
  if (error) return { error: 'No se pudo enviar el comentario.' }

  revalidatePath('/clients')
  return { ok: true }
}
