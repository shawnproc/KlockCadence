import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'finance'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const svc = createServiceClient()

  const { data: version } = await svc
    .from('policy_versions')
    .select('org_id, storage_path, version')
    .eq('id', params.id)
    .single()

  if (!version) return NextResponse.json({ error: 'Version not found.' }, { status: 404 })

  const v = version as { org_id: string; storage_path: string; version: string }

  if (v.org_id !== profile.org_id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  if (!v.storage_path) {
    return NextResponse.json({ error: 'No PDF available for this version (initial version).' }, { status: 404 })
  }

  const { data: signedData, error: signedError } = await svc.storage
    .from('policy-documents')
    .createSignedUrl(v.storage_path, 3600)

  if (signedError || !signedData?.signedUrl) {
    console.error('[policy/download] signed url error:', signedError?.message)
    return NextResponse.json({ error: 'Failed to generate download link.' }, { status: 500 })
  }

  return NextResponse.redirect(signedData.signedUrl)
}
