import type { UserRole } from '@/lib/supabase/types'
import { hasPermission } from '@/lib/auth/permissions'

/** El mapa del supervisor: On Site es el paso 1 (generar ideas + grabar). */
export const SUPERVISOR_PROCESS = [
  { n: 1, href: '/onsite', label: 'On Site', hint: 'Generar las ideas y grabar' },
  { n: 2, href: '/revision', label: 'Revisión', hint: 'Los editores entregan el video' },
  { n: 3, href: '/entregas', label: 'Entregas', hint: 'Copy, calendario y publicar' },
] as const

export type SupervisorProcessStep = (typeof SUPERVISOR_PROCESS)[number]

export function supervisorProcessView(pathname: string): Array<
  SupervisorProcessStep & { current: boolean; done: boolean }
> {
  const idx = SUPERVISOR_PROCESS.findIndex(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`) || pathname.startsWith(`${s.href}?`),
  )
  const currentIdx = idx === -1 ? 0 : idx
  return SUPERVISOR_PROCESS.map((s, i) => ({
    ...s,
    current: i === currentIdx,
    done: i < currentIdx,
  }))
}

export function supervisorNavLabel(
  href: string,
  role: UserRole | null | undefined,
  fallback: string,
): string {
  const base = SUPERVISOR_PROCESS.find((s) => s.href === href)
  if (!base) return fallback
  if (!hasPermission(role ?? null, 'recording.brief')) return fallback
  return `${base.n} · ${base.label}`
}
