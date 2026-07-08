import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { IntegrationType, SyncFrequency } from '@/types'

const VALID_TYPES: IntegrationType[] = ['quickbooks', 'gusto', 'adp', 'xero', 'sage_intacct', 'deltek']

function isValidType(t: string): t is IntegrationType {
  return VALID_TYPES.includes(t as IntegrationType)
}

interface RouteContext {
  params: { type: string }
}

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { type } = params
  if (!isValidType(type)) return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, org_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const svc = await createServiceClient()
  const { data } = await svc
    .from('integrations')
    .select('id, status, last_sync_at, last_sync_status, last_error_message, sync_frequency, error_notify_user_id, realm_id, token_expires_at, updated_at')
    .eq('org_id', profile.org_id)
    .eq('integration_type', type)
    .maybeSingle()

  return NextResponse.json({ settings: data ?? null })
}

interface SettingsBody {
  sync_frequency?: SyncFrequency
  error_notify_user_id?: string | null
}

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { type } = params
  if (!isValidType(type)) return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, org_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = (await req.json()) as SettingsBody
  const svc = await createServiceClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.sync_frequency) updates.sync_frequency = body.sync_frequency
  if ('error_notify_user_id' in body) updates.error_notify_user_id = body.error_notify_user_id

  await svc
    .from('integrations')
    .upsert(
      { org_id: profile.org_id, integration_type: type, ...updates },
      { onConflict: 'org_id,integration_type' }
    )

  return NextResponse.json({ ok: true })
}
