import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOAuthState } from '@/lib/integrations/oauth-state'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const SCOPE = 'openid profile email offline_access accounting.transactions'

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, org_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const state = createOAuthState(profile.org_id as string, user.id)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.XERO_CLIENT_ID!,
    redirect_uri: process.env.XERO_REDIRECT_URI!,
    scope: SCOPE,
    state,
  })
  return NextResponse.redirect(`${XERO_AUTH_URL}?${params.toString()}`)
}
