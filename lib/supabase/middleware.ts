import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Strip UTF-8 BOM (U+FEFF) that PowerShell can inject when piping env vars to the Vercel CLI
const clean = (s: string | undefined) => (s || '').replace(/^﻿/, '')

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
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

  const isLoginRoute = request.nextUrl.pathname.startsWith('/login')
  const isSignupRoute = request.nextUrl.pathname.startsWith('/signup')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')
  const isAuthApiRoute = request.nextUrl.pathname.startsWith('/api/auth')
  const isPublicRoute = request.nextUrl.pathname === '/'

  // Enforce is_active for authenticated API calls in one place: a deactivated
  // user must not be able to act even while their access token is still valid.
  // Auth endpoints (signup/join/callback/logout) are pre-auth and excluded.
  if (user && isApiRoute && !isAuthApiRoute) {
    const { data: activeCheck } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle()
    if (activeCheck && activeCheck.is_active === false) {
      return NextResponse.json({ error: 'Your account has been deactivated.' }, { status: 403 })
    }
  }

  if (!user && !isLoginRoute && !isSignupRoute && !isApiRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
