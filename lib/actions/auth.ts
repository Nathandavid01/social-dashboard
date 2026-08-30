'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SESSION_ONLY_COOKIE } from '@/lib/supabase/cookie-persistence'

export async function signIn(formData: FormData) {
  // "Mantener sesión iniciada": unchecked → auth cookies become browser-session
  // cookies, plus a marker so the middleware keeps them that way on refresh.
  const remember = Boolean(formData.get('remember'))
  const supabase = await createClient({ sessionOnly: !remember })

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  const cookieStore = await cookies()
  if (remember) {
    cookieStore.delete(SESSION_ONLY_COOKIE)
  } else {
    // No maxAge on purpose — the marker itself dies with the browser session.
    cookieStore.set(SESSION_ONLY_COOKIE, '1', { httpOnly: true, sameSite: 'lax', path: '/' })
  }

  revalidatePath('/', 'layout')
  redirect('/pipeline')
}

/**
 * Public self-registration is disabled. Accounts are created only from inside
 * the app by an admin (Equipo → Crear usuario, see lib/actions/users.ts). This
 * stub stays so nothing imports a missing symbol, but it never creates a user.
 */
export async function signUp(_formData: FormData) {
  return { error: 'El registro está deshabilitado. Pide a un administrador que cree tu cuenta.' }
}

/**
 * Self-service password change for a logged-in user. Re-verifies the current
 * password (via a sign-in check) before updating — no email required, so it
 * works for admin-created users replacing their temporary password. Validation
 * mirrors validatePasswordChange (lib/utils/password-core.ts).
 */
export async function updatePassword(input: {
  current: string
  next: string
  confirm: string
}): Promise<{ ok?: true; error?: string }> {
  const { validatePasswordChange } = await import('@/lib/utils/password-core')
  const valid = validatePasswordChange(input)
  if (!valid.ok) return { error: valid.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'No autenticado.' }

  // Confirm identity by re-checking the current password.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.current,
  })
  if (signInError) return { error: 'La contraseña actual es incorrecta.' }

  const { error } = await supabase.auth.updateUser({ password: input.next })
  if (error) return { error: error.message }

  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
