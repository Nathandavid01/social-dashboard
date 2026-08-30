import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SESSION_ONLY_COOKIE } from '@/lib/supabase/cookie-persistence'

/**
 * OAuth callback (Google → Supabase → aquí). Exchanges the PKCE code for a
 * session and lands on /pipeline; the dashboard layout takes over from there
 * (pending/rejected accounts get bounced by it, same as password logins).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const providerError = url.searchParams.get('error_description') ?? url.searchParams.get('error')

  const toLogin = (message: string) =>
    NextResponse.redirect(
      new URL(`/login?oauth_error=${encodeURIComponent(message)}`, url.origin)
    )

  if (!code) {
    return toLogin(providerError ?? 'No se recibió el código de Google. Intenta de nuevo.')
  }

  // OAuth logins are always persistent — clear any stale session-only marker
  // left by a previous password login so the middleware doesn't downgrade this
  // session's cookies on refresh.
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_ONLY_COOKIE)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return toLogin(error.message)
  }

  return NextResponse.redirect(new URL('/pipeline', url.origin))
}
