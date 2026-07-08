import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { IntegrationType } from '@/types'

const VALID_TYPES: IntegrationType[] = ['quickbooks', 'gusto', 'adp', 'xero', 'sage_intacct', 'deltek']
function isValidType(t: string): t is IntegrationType { return VALID_TYPES.includes(t as IntegrationType) }

interface RouteContext { params: { type: string } }

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { type } = params
  if (!isValidType(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, org_id').eq('id', user.id).single()
  if (!profile || !['admin', 'finance'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = await createServiceClient()
  const { data } = await svc
    .from('integration_sync_events')
    .select('id, status, records_synced, error_message, created_at, users!triggered_by(full_name)')
    .eq('org_id', profile.org_id)
    .eq('integration_type', type)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ events: data ?? [] })
}
