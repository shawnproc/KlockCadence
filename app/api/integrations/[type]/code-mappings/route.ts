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
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = await createServiceClient()
  const { data } = await svc
    .from('integration_code_mappings')
    .select('id, charge_code_id, external_code, external_name, updated_at')
    .eq('org_id', profile.org_id)
    .eq('integration_type', type)
    .order('updated_at', { ascending: false })

  return NextResponse.json({ mappings: data ?? [] })
}

interface CodeMappingBody {
  charge_code_id: string
  external_code: string
  external_name?: string
}

export async function PUT(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { type } = params
  if (!isValidType(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('role, org_id').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json()) as { mappings: CodeMappingBody[] }
  const svc = await createServiceClient()

  for (const m of body.mappings) {
    if (!m.charge_code_id || !m.external_code) continue
    await svc.from('integration_code_mappings').upsert(
      {
        org_id: profile.org_id,
        integration_type: type,
        charge_code_id: m.charge_code_id,
        external_code: m.external_code,
        external_name: m.external_name ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,integration_type,charge_code_id' }
    )
  }

  return NextResponse.json({ ok: true })
}
