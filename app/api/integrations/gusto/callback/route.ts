import { NextRequest, NextResponse } from 'next/server'
import { verifyOAuthState } from '@/lib/integrations/oauth-state'
import { exchangeGustoCode } from '@/lib/integrations/gusto/client'
import { writeAuditLog } from '@/lib/audit/logger'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const dashboardUrl = new URL('/admin/integrations', req.nextUrl.origin)

  if (!code || !state) {
    dashboardUrl.searchParams.set('error', 'missing_params')
    return NextResponse.redirect(dashboardUrl)
  }

  const parsed = verifyOAuthState(state)
  if (!parsed) {
    dashboardUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(dashboardUrl)
  }

  try {
    await exchangeGustoCode(parsed.orgId, code)
    await writeAuditLog({
      org_id: parsed.orgId,
      actor_id: parsed.userId,
      action: 'INTEGRATION_CONNECTED',
      target_table: 'integrations',
      target_id: 'gusto',
      new_value: { integration_type: 'gusto' },
    })
    dashboardUrl.searchParams.set('connected', 'gusto')
  } catch {
    dashboardUrl.searchParams.set('error', 'token_exchange_failed')
  }

  return NextResponse.redirect(dashboardUrl)
}
