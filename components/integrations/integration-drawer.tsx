'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, AlertTriangle, CheckCircle2, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmployeeMappingTable } from './employee-mapping-table'
import { CodeMappingTable } from './code-mapping-table'
import { SyncHistoryTable } from './sync-history-table'
import { INTEGRATION_META } from './meta'
import { formatDateTime } from '@/lib/utils'
import type { IntegrationType } from '@/types'

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

interface IntegrationDrawerProps {
  type: IntegrationType
  status: 'connected' | 'disconnected' | 'error'
  lastSyncAt: string | null
  lastError: string | null
  syncFrequency: string
  kcUsers: KCUser[]
  chargeCodes: ChargeCode[]
  onClose: () => void
  onDisconnected: () => void
}

type Tab = 'overview' | 'employees' | 'codes' | 'history'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'employees', label: 'Employee Mapping' },
  { id: 'codes', label: 'Charge Codes' },
  { id: 'history', label: 'Sync History' },
]

export function IntegrationDrawer({
  type,
  status,
  lastSyncAt,
  lastError,
  syncFrequency: initialFreq,
  kcUsers,
  chargeCodes,
  onClose,
  onDisconnected,
}: IntegrationDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [freq, setFreq] = useState(initialFreq)
  const [savingFreq, setSavingFreq] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const meta = INTEGRATION_META[type]
  const isOAuth = meta.oauthType === 'oauth'
  const isFile = meta.oauthType === 'file'
  const isConnected = status === 'connected'

  // Default date range: current month
  const today = new Date()
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = today.toISOString().split('T')[0]!

  async function handleSaveFrequency() {
    setSavingFreq(true)
    try {
      const res = await fetch(`/api/integrations/${type}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_frequency: freq }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Sync frequency updated.')
    } catch {
      toast.error('Failed to update frequency.')
    } finally {
      setSavingFreq(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch(`/api/integrations/${type}/disconnect`, { method: 'POST' })
      if (!res.ok) throw new Error('Disconnect failed')
      toast.success(`${meta.name} disconnected.`)
      onDisconnected()
      onClose()
    } catch {
      toast.error('Failed to disconnect.')
    } finally {
      setDisconnecting(false)
      setConfirmDisconnect(false)
    }
  }

  async function handleSyncNow() {
    if (!meta.syncPath) return
    setSyncing(true)
    try {
      const res = await fetch(meta.syncPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: monthStart, end_date: monthEnd }),
      })
      const data = (await res.json()) as { status?: string; records_synced?: number; errors?: string[] }
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Sync failed')
      toast.success(`Sync complete: ${data.records_synced} records.`)
      if (data.errors && data.errors.length > 0) {
        toast.warning(`${data.errors.length} error(s). See sync history.`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleExport() {
    if (!meta.exportPath) return
    const url = `${meta.exportPath}?start_date=${monthStart}&end_date=${monthEnd}`
    window.open(url, '_blank')
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: meta.color }}
            >
              {meta.initials}
            </div>
            <div>
              <h2 className="font-semibold text-sm">{meta.name}</h2>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Connection status */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="flex items-center gap-2">
                  {isConnected
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <WifiOff className="h-4 w-4 text-muted-foreground" />
                  }
                  <span className="text-sm font-medium">
                    {isConnected ? 'Connected' : status === 'error' ? 'Connection error' : 'Not connected'}
                  </span>
                </div>
                {lastSyncAt && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last sync: {formatDateTime(lastSyncAt)}
                  </div>
                )}
              </div>

              {/* Error details */}
              {lastError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-sm font-semibold text-red-800">Last sync error</span>
                  </div>
                  <p className="text-xs text-red-700">{lastError}</p>
                  <div className="text-xs text-red-700 space-y-1">
                    <p className="font-medium">Resolution steps:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Verify your {meta.name} credentials are still valid</li>
                      <li>Check employee and charge code mappings are complete</li>
                      <li>Ensure {meta.name} account has write permissions</li>
                      <li>Use Retry Sync below</li>
                    </ol>
                  </div>
                  {isOAuth && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSyncNow}
                      disabled={syncing}
                      className="h-7 text-xs gap-1.5 mt-2"
                    >
                      <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                      Retry Sync
                    </Button>
                  )}
                </div>
              )}

              {/* Sync actions */}
              {isConnected && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Manual Sync</p>
                  <p className="text-xs text-muted-foreground">
                    Syncs approved timesheets for the current month ({monthStart} → {monthEnd}).
                  </p>
                  <div className="flex gap-2">
                    {isOAuth && meta.syncPath && (
                      <Button
                        size="sm"
                        onClick={handleSyncNow}
                        disabled={syncing}
                        className="h-8 text-xs gap-1.5"
                        style={{ backgroundColor: '#1B2A4A' }}
                      >
                        <Wifi className="h-3.5 w-3.5" />
                        {syncing ? 'Syncing…' : 'Sync Now'}
                      </Button>
                    )}
                    {isFile && meta.exportPath && (
                      <Button
                        size="sm"
                        onClick={handleExport}
                        className="h-8 text-xs gap-1.5"
                        style={{ backgroundColor: '#1B2A4A' }}
                      >
                        Download Export
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Sync frequency (OAuth only) */}
              {isOAuth && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sync Frequency</p>
                  <div className="flex items-center gap-3">
                    <select
                      value={freq}
                      onChange={(e) => setFreq(e.target.value)}
                      className="rounded-md border px-3 py-1.5 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                      <option value="manual">Manual only</option>
                      <option value="daily">Daily (midnight UTC)</option>
                      <option value="realtime">Real-time (on approval)</option>
                    </select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveFrequency}
                      disabled={savingFreq}
                      className="h-8 text-xs"
                    >
                      {savingFreq ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                  {freq === 'realtime' && (
                    <p className="text-xs text-muted-foreground">
                      Real-time sync triggers automatically when a timesheet is approved.
                    </p>
                  )}
                </div>
              )}

              {/* Disconnect */}
              {(isConnected || status === 'error') && (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Danger Zone</p>
                  {confirmDisconnect ? (
                    <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 space-y-3">
                      <p className="text-sm font-semibold text-red-800">Disconnect {meta.name}?</p>
                      <p className="text-xs text-red-700">
                        This will revoke access and clear all stored tokens. Employee and charge code
                        mappings will be preserved. You can reconnect at any time.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleDisconnect}
                          disabled={disconnecting}
                          className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                        >
                          {disconnecting ? 'Disconnecting…' : 'Yes, Disconnect'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDisconnect(false)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmDisconnect(true)}
                      className="h-8 text-xs text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Disconnect {meta.name}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'employees' && (
            <EmployeeMappingTable integrationType={type} kcUsers={kcUsers} />
          )}

          {activeTab === 'codes' && (
            <CodeMappingTable integrationType={type} chargeCodes={chargeCodes} />
          )}

          {activeTab === 'history' && (
            <SyncHistoryTable integrationType={type} />
          )}
        </div>
      </motion.div>
    </>
  )
}
