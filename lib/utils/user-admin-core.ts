import { ASSIGNABLE_ROLES } from '@/lib/auth/permissions'
import type { UserRole } from '@/lib/supabase/types'

/**
 * Pure validation for creating a new team user. Kept out of the `'use server'`
 * action so the rules are unit-testable without Supabase. Mirrors the same gates
 * the action enforces server-side (an owner picks email + name + assignable role
 * + a temporary password the new user changes on first login).
 */
export interface NewUserInput {
  email: string
  fullName: string
  role: UserRole
  password: string
}

export type NewUserValidation = { ok: true } | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD_LENGTH = 8

export function validateNewUser(input: Partial<NewUserInput>): NewUserValidation {
  const email = input.email?.trim() ?? ''
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Escribe un email válido.' }
  if (!input.fullName?.trim()) return { ok: false, error: 'El nombre es obligatorio.' }
  if (!input.role || !ASSIGNABLE_ROLES.includes(input.role)) {
    return { ok: false, error: 'Elige un rol válido.' }
  }
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }
  }
  return { ok: true }
}
