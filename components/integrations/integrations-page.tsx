'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { IntegrationCard } from './integration-card'
import { IntegrationDrawer } from './integration-drawer'
import { INTEGRATION_META, INTEGRATION_ORDER } from './meta'
import type { IntegrationType, Integration } from '@/types'

interface KCUser {
  id: string
  full_name: string
  email: string
  department: string
}

interface ChargeCode {
  id: string
  code: string
  description: string
  is_billable: boolean
}

interface IntegrationsPageProps {
  integrations: Integration[]
  kcUsers: KCUser[]
  chargeCodes: ChargeCode[]
}

export function IntegrationsPage({ integrations, kcUsers, chargeCodes }: IntegrationsPageProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const connected = searchParams.get('connected')
  const error = searchParams.get('error')

  useEffect(() => {
    if (connected) {
      const meta = INTEGRATION_META[connected as IntegrationType]
      toast.success(`${meta?.name ?? connected} connected successfully.`)
      router.replace('/admin/integrations')
    }
    if (error) {
      toast.error(errorLabel(error))
      router.replace('/admin/integrations')
    }
  }, [connected, error, router])

  // Integration state map (indexed by type)
  const [integrationMap, setIntegrationMap] = useState<Map<IntegrationType, Integration>>(
    () => new Map(integrations.map((i) => [i.integration_type, i]))
  )
  const [openDrawer, setOpenDrawer] = useState<IntegrationType | null>(null)
  const [syncing, setSyncing] = useState<IntegrationType | null>(null)

  function getStatus(type: IntegrationType): 'connected' | 'disconnected' | 'error' | 'coming_soon' {
    const integration = integrationMap.get(type)
    if (!integration) return 'disconnected'
    return integration.status
  }

  function getIntegration(type: IntegrationType): Integration | null {
    return integrationMap.get(type) ?? null
  }

  function handleConnect(type: IntegrationType) {
    const meta = INTEGRATION_META[type]
    if (meta.authPath) {
      window.location.href = meta.authPath
    }
    // File-based integrations open the drawer directly
    if (meta.oauthType === 'file') {
      setOpenDrawer(type)
    }
  }

  async function handleSyncNow(type: IntegrationType) {
    const meta = INTEGRATION_META[type]
    if (!meta.syncPath && !meta.exportPath) return

    if (meta.exportPath) {
      // File export — trigger download
      const today = new Date()
      const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
      const monthEnd = today.toISOString().split('T')[0]!
      window.open(`${meta.exportPath}?start_date=${monthStart}&end_date=${monthEnd}`, '_blank')
      return
    }

    setSyncing(type)
    try {
      const today = new Date()
      const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
      const monthEnd = today.toISOString().split('T')[0]!

      const res = await fetch(meta.syncPath!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: monthStart, end_date: monthEnd }),
      })
      const data = (await res.json()) as { status?: string; records_synced?: number; errors?: string[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      toast.success(`Sync complete: ${data.records_synced} records.`)
      if ((data.errors?.length ?? 0) > 0) {
        toast.warning(`${data.errors!.length} error(s) — open Configure for details.`)
      }

      // Refresh integration status
      setIntegrationMap((prev) => {
        const next = new Map(prev)
        const existing = next.get(type)
        if (existing) {
          next.set(type, {
            ...existing,
            last_sync_at: new Date().toISOString(),
            last_sync_status: (data.status ?? 'success') as 'success' | 'error' | 'partial',
          })
        }
        return next
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed.')
    } finally {
      setSyncing(null)
    }
  }

  function handleDisconnected(type: IntegrationType) {
    setIntegrationMap((prev) => {
      const next = new Map(prev)
      const existing = next.get(type)
      if (existing) {
        next.set(type, { ...existing, status: 'disconnected' })
      }
      return next
    })
  }

  const drawerIntegration = openDrawer ? getIntegration(openDrawer) : null

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATION_ORDER.map((type) => {
          const integration = getIntegration(type)
          const status = getStatus(type)
          return (
            <IntegrationCard
              key={type}
              type={type}
              status={status}
              lastSyncAt={integration?.last_sync_at ?? null}
              lastSyncStatus={integration?.last_sync_status ?? null}
              lastError={integration?.last_error_message ?? null}
              syncing={syncing === type}
              onConfigure={() => setOpenDrawer(type)}
              onSyncNow={() => handleSyncNow(type)}
              onConnect={() => handleConnect(type)}
            />
          )
        })}
      </div>

      <AnimatePresence>
        {openDrawer && (
          <IntegrationDrawer
            type={openDrawer}
            status={(drawerIntegration?.status ?? 'disconnected') as 'connected' | 'disconnected' | 'error'}
            lastSyncAt={drawerIntegration?.last_sync_at ?? null}
            lastError={drawerIntegration?.last_error_message ?? null}
            syncFrequency={drawerIntegration?.sync_frequency ?? 'manual'}
            kcUsers={kcUsers}
            chargeCodes={chargeCodes}
            onClose={() => setOpenDrawer(null)}
            onDisconnected={() => handleDisconnected(openDrawer)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function errorLabel(code: string): string {
  const labels: Record<string, string> = {
    invalid_state: 'OAuth state expired or invalid. Please try connecting again.',
    token_exchange_failed: 'Token exchange failed. Check your credentials.',
    missing_params: 'OAuth callback was missing required parameters.',
  }
  return labels[code] ?? `Connection error: ${code}`
}
