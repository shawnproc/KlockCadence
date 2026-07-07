'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AlertTriangle, AlertCircle, Info, Shield, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import type { AnomalySeverity, AnomalyType } from '@/types'

interface AnomalyRow {
  id: string
  anomaly_type: AnomalyType
  severity: AnomalySeverity
  description: string
  resolved: boolean
  resolved_at: string | null
  created_at: string
  users: { full_name: string; email: string } | null
}

const SEVERITY_CONFIG: Record<AnomalySeverity, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  classes: string
}> = {
  critical: { label: 'CRITICAL', icon: AlertCircle,   classes: 'border-red-200 bg-red-50 text-red-700' },
  high:     { label: 'HIGH',     icon: AlertTriangle,  classes: 'border-orange-200 bg-orange-50 text-orange-700' },
  medium:   { label: 'MEDIUM',   icon: Shield,         classes: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
  low:      { label: 'LOW',      icon: Info,           classes: 'border-blue-200 bg-blue-50 text-blue-700' },
}

const SEVERITY_ORDER: Record<AnomalySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const TYPE_LABELS: Record<AnomalyType, string> = {
  insufficient_balance: 'Insufficient Balance',
  unauthorized_balance_edit: 'Unauthorized Balance Edit',
  missing_timesheet: 'Missing Timesheet',
  hours_shortage: 'Hours Shortage',
  timesheet_modified_after_certification: 'Post-Certification Modification',
  late_entry_pattern: 'Late Entry Pattern',
  missing_accrual: 'Missing Accrual',
  policy_unacknowledged: 'Policy Not Acknowledged',
  proxy_entry_unacknowledged: 'Proxy Entry Not Acknowledged',
}

function getInitials(name: string | undefined | null) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function sortAnomalies(items: AnomalyRow[]) {
  return [...items].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sev !== 0) return sev
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

interface AnomalyFeedProps {
  anomalies: AnomalyRow[]
  resolverId: string
  orgId: string
}

export function AnomalyFeed({ anomalies, resolverId, orgId }: AnomalyFeedProps) {
  const supabase = createClient()
  const [items, setItems] = useState(anomalies)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const [resolving, setResolving] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function handleResolve(id: string) {
    setResolving((r) => ({ ...r, [id]: true }))
    try {
      const { error } = await supabase
        .from('anomalies')
        .update({ resolved: true, resolved_by: resolverId, resolved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('org_id', orgId)

      if (error) throw new Error(error.message)
      setItems((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a
        )
      )
      toast.success('Anomaly marked resolved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to resolve.')
    } finally {
      setResolving((r) => ({ ...r, [id]: false }))
    }
  }

  const baseFiltered = items.filter((a) => {
    if (filter === 'open') return !a.resolved
    if (filter === 'resolved') return a.resolved
    return true
  })
  const filtered = sortAnomalies(baseFiltered)

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 border-b pb-2">
        {(['open', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors capitalize',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {f}
            {f === 'open' && ` (${items.filter((a) => !a.resolved).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          {filter === 'open' ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="font-medium text-green-700">No compliance issues detected</p>
              <p className="text-sm text-muted-foreground">Your organization is audit ready.</p>
            </div>
          ) : (
            <p className="text-muted-foreground">No anomalies found.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((anomaly) => {
            const config = SEVERITY_CONFIG[anomaly.severity]
            const Icon = config.icon
            const isExpanded = expanded[anomaly.id] ?? false

            return (
              <div
                key={anomaly.id}
                className={cn(
                  'rounded-lg border p-4 transition-opacity',
                  config.classes,
                  anomaly.resolved ? 'opacity-50' : ''
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Avatar */}
                  <div className="h-8 w-8 shrink-0 rounded-full bg-white/60 border border-current/20 flex items-center justify-center text-[11px] font-bold">
                    {getInitials(anomaly.users?.full_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs font-bold tracking-wide">{config.label}</span>
                      <span className="text-xs font-medium">{TYPE_LABELS[anomaly.anomaly_type]}</span>
                      {anomaly.resolved && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Resolved
                        </span>
                      )}
                    </div>

                    <p className="text-sm mt-1">{anomaly.description}</p>

                    <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                      <span className="font-medium">{anomaly.users?.full_name}</span>
                      <span>·</span>
                      <span>{formatDateTime(anomaly.created_at)}</span>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-current/10 space-y-1 text-xs opacity-80">
                        {anomaly.users?.email && (
                          <p><span className="font-medium">Email:</span> {anomaly.users.email}</p>
                        )}
                        <p><span className="font-medium">Status:</span> {anomaly.resolved ? 'Resolved' : 'Open'}</p>
                        {anomaly.resolved_at && (
                          <p><span className="font-medium">Resolved at:</span> {formatDateTime(anomaly.resolved_at)}</p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [anomaly.id]: !isExpanded }))}
                      className="mt-2 flex items-center gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
                    >
                      {isExpanded ? <><ChevronUp className="h-3 w-3" /> Hide details</> : <><ChevronDown className="h-3 w-3" /> View details</>}
                    </button>
                  </div>

                  {!anomaly.resolved && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolve(anomaly.id)}
                      disabled={resolving[anomaly.id]}
                      className="shrink-0 bg-white hover:bg-white/80"
                    >
                      {resolving[anomaly.id] ? 'Resolving…' : 'Resolve'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
