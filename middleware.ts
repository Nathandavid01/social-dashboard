import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { areaForPath, canAccessPath } from '@/lib/auth/areas'
import type { UserRole } from '@/lib/supabase/types'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Per-user area access enforcement. Only hit the DB when the path actually maps
  // to a restricted area (keeps /api, assets and essentials query-free).
  const path = request.nextUrl.pathname
  if (user && areaForPath(path)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, area_access')
      .eq('id', user.id)
      .single()
    if (profile && !canAccessPath(path, profile.role as UserRole, profile.area_access as string[] | null)) {
      const url = request.nextUrl.clone()
      url.pathname = '/home'
      url.search = ''
      const redirect = NextResponse.redirect(url)
      // Preserve any refreshed auth cookies on the redirect response.
      supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c))
      return redirect
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
