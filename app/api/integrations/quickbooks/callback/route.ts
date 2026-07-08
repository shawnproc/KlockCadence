import { NextRequest, NextResponse } from 'next/server'
import { verifyOAuthState } from '@/lib/integrations/oauth-state'
import { exchangeCode } from '@/lib/integrations/quickbooks/client'
import { autoMatchQBOEmployees } from '@/lib/integrations/quickbooks/auto-match'
import { writeAuditLog } from '@/lib/audit/logger'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const realmId = searchParams.get('realmId')
  const error = searchParams.get('error')

  const dashboardUrl = new URL('/admin/integrations', req.nextUrl.origin)

  if (error || !code || !state || !realmId) {
    dashboardUrl.searchParams.set('error', error ?? 'missing_params')
    return NextResponse.redirect(dashboardUrl)
  }

  const parsed = verifyOAuthState(state)
  if (!parsed) {
    dashboardUrl.searchParams.set('error', 'invalid_state')
    return NextResponse.redirect(dashboardUrl)
  }

  try {
    await exchangeCode(parsed.orgId, code, realmId)

    // Auto-match KC users to QBO employees by email/name (non-fatal)
    try {
      await autoMatchQBOEmployees(parsed.orgId)
    } catch (matchErr) {
      console.warn('[QBO callback] auto-match failed (non-fatal):', matchErr instanceof Error ? matchErr.message : matchErr)
    }

    await writeAuditLog({
      org_id: parsed.orgId,
      actor_id: parsed.userId,
      action: 'INTEGRATION_CONNECTED',
      target_table: 'integrations',
      target_id: parsed.orgId,
      new_value: { integration_type: 'quickbooks', realm_id: realmId },
    })

    dashboardUrl.searchParams.set('connected', 'quickbooks')
  } catch (e) {
    console.error('[QBO callback] token exchange failed:', e instanceof Error ? e.message : e)
    const svc = createServiceClient()
    await svc
      .from('integrations')
      .upsert(
        {
          org_id: parsed.orgId,
          integration_type: 'quickbooks',
          status: 'error',
          last_error_message: e instanceof Error ? e.message : 'Connection failed',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,integration_type' }
      )
    dashboardUrl.searchParams.set('error', 'token_exchange_failed')
  }

  return NextResponse.redirect(dashboardUrl)
}
