/**
 * Stable per-USER accent color for the pipeline board. Each team member maps to
 * a color, so an assigned batch is shown in that person's color — the board
 * becomes a visual map of who owns what. Unassigned → neutral gray.
 *
 * Mirrors the client-accent palette shape so the two can be swapped freely.
 */
export interface UserAccent {
  name: string
  dot: string
  ring: string
  soft: string
  text: string
}

const NEUTRAL: UserAccent = { name: 'slate', dot: '#64748B', ring: 'rgba(100,116,139,0.4)', soft: 'rgba(100,116,139,0.14)', text: '#94A3B8' }

const ACCENTS: UserAccent[] = [
  { name: 'emerald', dot: '#10B981', ring: 'rgba(16,185,129,0.4)', soft: 'rgba(16,185,129,0.14)', text: '#34D399' },
  { name: 'cyan', dot: '#06B6D4', ring: 'rgba(6,182,212,0.4)', soft: 'rgba(6,182,212,0.14)', text: '#22D3EE' },
  { name: 'violet', dot: '#8B5CF6', ring: 'rgba(139,92,246,0.4)', soft: 'rgba(139,92,246,0.14)', text: '#A78BFA' },
  { name: 'amber', dot: '#F59E0B', ring: 'rgba(245,158,11,0.4)', soft: 'rgba(245,158,11,0.14)', text: '#FBBF24' },
  { name: 'rose', dot: '#F43F5E', ring: 'rgba(244,63,94,0.4)', soft: 'rgba(244,63,94,0.14)', text: '#FB7185' },
  { name: 'sky', dot: '#0EA5E9', ring: 'rgba(14,165,233,0.4)', soft: 'rgba(14,165,233,0.14)', text: '#38BDF8' },
  { name: 'orange', dot: '#FB923C', ring: 'rgba(251,146,60,0.4)', soft: 'rgba(251,146,60,0.14)', text: '#FDBA74' },
  { name: 'lime', dot: '#84CC16', ring: 'rgba(132,204,22,0.4)', soft: 'rgba(132,204,22,0.14)', text: '#A3E635' },
]

/** Stable color for a user id. null/undefined (unassigned) → neutral gray. */
export function userAccent(userId: string | null | undefined): UserAccent {
  if (!userId) return NEUTRAL
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

export const UNASSIGNED_ACCENT = NEUTRAL
