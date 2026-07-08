import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clearTokens } from '@/lib/integrations/tokens'
import { writeAuditLog } from '@/lib/audit/logger'
import type { IntegrationType } from '@/types'

const VALID_TYPES: IntegrationType[] = ['quickbooks', 'gusto', 'adp', 'xero', 'sage_intacct', 'deltek']
function isValidType(t: string): t is IntegrationType { return VALID_TYPES.includes(t as IntegrationType) }

interface RouteContext { params: { type: string } }

export async function POST(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { type } = params
  if (!isValidType(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, org_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = profile.org_id as string

  // Revoke token with provider if OAuth
  if (type === 'quickbooks') {
    try {
      const { disconnectQBO } = await import('@/lib/integrations/quickbooks/client')
      await disconnectQBO(orgId)
    } catch {
      // Non-fatal — still clear local tokens
    }
  }

  await clearTokens(orgId, type)

  await writeAuditLog({
    org_id: orgId,
    actor_id: user.id,
    action: 'INTEGRATION_DISCONNECTED',
    target_table: 'integrations',
    target_id: type,
    new_value: { integration_type: type },
  })

  return NextResponse.json({ ok: true })
}
