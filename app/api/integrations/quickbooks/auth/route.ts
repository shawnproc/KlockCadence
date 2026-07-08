import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOAuthState } from '@/lib/integrations/oauth-state'

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const SCOPE = 'com.intuit.quickbooks.accounting'

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  if (!profile.org_id) {
    return NextResponse.json({ error: 'Organization not configured' }, { status: 400 })
  }

  if (!process.env.QBO_CLIENT_ID || !process.env.QBO_REDIRECT_URI || !process.env.INTEGRATION_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'QuickBooks integration not configured on server' }, { status: 500 })
  }

  let state: string
  try {
    state = createOAuthState(profile.org_id as string, user.id)
  } catch (e) {
    console.error('[QBO auth]', e)
    return NextResponse.json({ error: 'Failed to create OAuth state' }, { status: 500 })
  }

  const params = new URLSearchParams({
    client_id: process.env.QBO_CLIENT_ID,
    scope: SCOPE,
    redirect_uri: process.env.QBO_REDIRECT_URI,
    response_type: 'code',
    state,
  })

  return NextResponse.redirect(`${QBO_AUTH_URL}?${params.toString()}`)
}
