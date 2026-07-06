'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { AlertTriangle, AlertCircle, Info, Shield, CheckCircle2, User } from 'lucide-react'
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
  critical: { label: 'CRITICAL', icon: AlertCircle, classes: 'border-red-200 bg-red-50 text-red-700' },
  high:     { label: 'HIGH',     icon: AlertTriangle, classes: 'border-orange-200 bg-orange-50 text-orange-700' },
  medium:   { label: 'MEDIUM',  icon: Shield, classes: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
  low:      { label: 'LOW',     icon: Info, classes: 'border-blue-200 bg-blue-50 text-blue-700' },
}

const TYPE_LABELS: Record<AnomalyType, string> = {
  insufficient_balance: 'Insufficient Balance',
  unauthorized_balance_edit: 'Unauthorized Balance Edit',
  missing_timesheet: 'Missing Timesheet',
  hours_shortage: 'Hours Shortage',
  timesheet_modified_after_certification: 'Post-Certification Modification',
  late_entry_pattern: 'Late Entry Pattern',
  missing_accrual: 'Missing Accrual',
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

  const filtered = items.filter((a) => {
    if (filter === 'open') return !a.resolved
    if (filter === 'resolved') return a.resolved
    return true
  })

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
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {filter === 'open' ? 'No open anomalies.' : 'No anomalies found.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((anomaly) => {
            const config = SEVERITY_CONFIG[anomaly.severity]
            const Icon = config.icon
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
                  <div className="flex items-start gap-3 flex-1">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {anomaly.users?.full_name}
                        </span>
                        <span>{formatDateTime(anomaly.created_at)}</span>
                      </div>
                    </div>
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
