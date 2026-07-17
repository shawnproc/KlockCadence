import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * POST /api/auth/password-set
 * Clears the caller's must_change_password flag after they have set a new
 * password. The flag is a server-authoritative column that authenticated
 * clients cannot update, so this runs as the service role for the caller only.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('users')
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
