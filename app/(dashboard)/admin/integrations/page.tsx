import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { IntegrationsPage } from '@/components/integrations/integrations-page'
import { AnimatedPage } from '@/components/ui/animated-page'
import { Plug } from 'lucide-react'
import type { Integration } from '@/types'

export default async function IntegrationsAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const orgId = profile.org_id as string
  const svc = createServiceClient()

  // Fetch all connected integrations for this org (intentionally excludes token columns)
  const [{ data: rawIntegrations }, { data: kcUsers }, { data: chargeCodes }] = await Promise.all([
    svc
      .from('integrations')
      .select('id, org_id, integration_type, status, last_sync_at, last_sync_status, last_error_message, sync_frequency, error_notify_user_id, realm_id, token_expires_at, config, created_at, updated_at')
      .eq('org_id', orgId),
    svc
      .from('users')
      .select('id, full_name, email, department')
      .eq('org_id', orgId)
      .eq('role', 'employee')
      .order('full_name'),
    svc
      .from('charge_codes')
      .select('id, code, description, is_billable')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('code'),
  ])

  return (
    <AnimatedPage>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#1B2A4A' }}
          >
            <Plug className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-sm text-muted-foreground">
              Connect KlockCadence to your payroll and accounting systems
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <span className="text-amber-600 text-sm font-semibold shrink-0">Required env vars:</span>
          <p className="text-xs text-amber-800">
            <code>INTEGRATION_ENCRYPTION_KEY</code> (64 hex chars) · QuickBooks:{' '}
            <code>QBO_CLIENT_ID</code>, <code>QBO_CLIENT_SECRET</code>, <code>QBO_REDIRECT_URI</code> ·
            Gusto: <code>GUSTO_CLIENT_ID</code>, <code>GUSTO_CLIENT_SECRET</code>, <code>GUSTO_REDIRECT_URI</code> ·
            Xero: <code>XERO_CLIENT_ID</code>, <code>XERO_CLIENT_SECRET</code>, <code>XERO_REDIRECT_URI</code>
          </p>
        </div>

        <IntegrationsPage
          integrations={(rawIntegrations ?? []) as unknown as Integration[]}
          kcUsers={kcUsers ?? []}
          chargeCodes={chargeCodes ?? []}
        />
      </div>
    </AnimatedPage>
  )
}
