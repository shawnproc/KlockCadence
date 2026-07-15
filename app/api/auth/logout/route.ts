import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/logout
 * Server-side sign-out. Clears the session cookies and redirects to /login.
 * Used by the dashboard layout to eject offboarded users (?reason=deactivated).
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const reason = searchParams.get('reason')

  const supabase = await createClient()
  await supabase.auth.signOut()

  const dest = reason === 'deactivated' ? '/login?deactivated=1' : '/login'
  return NextResponse.redirect(`${origin}${dest}`)
}
