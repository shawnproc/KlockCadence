'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  AlertTriangle, AlertCircle, Info, Shield, CheckCircle2, ChevronDown, ChevronUp,
  Calendar, FileText, Clock, ScrollText, BarChart3, FileSpreadsheet, UserCheck, Trash2, Layers,
} from 'lucide-react'
import type { AnomalySeverity, AnomalyType } from '@/types'

interface AnomalyRow {
  id: string
  user_id: string
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

interface TypeInfo {
  label: string
  icon: React.ComponentType<{ className?: string }>
  meaning: string
  why: string
  action: string
}

// Per-type explanation so each anomaly reads distinctly — what it is, why it's
// a DCAA concern, and how to resolve it — instead of a generic severity chip.
const TYPE_INFO: Record<AnomalyType, TypeInfo> = {
  insufficient_balance: {
    label: 'Insufficient Balance',
    icon: Calendar,
    meaning: 'A leave request is for more hours than the employee has available.',
    why: 'Approving leave beyond the accrued balance drives the balance negative and misstates leave liability on federal contracts.',
    action: 'Verify the balance, then reduce the request, correct the accrual, or deny it.',
  },
  unauthorized_balance_edit: {
    label: 'Unauthorized Balance Edit',
    icon: Shield,
    meaning: 'A leave balance was reduced by more hours than any approved request accounts for.',
    why: 'Balance changes without a matching approved request are a classic sign of manipulation and a direct DCAA audit finding.',
    action: 'Trace the change in the Audit Log, reconcile it against approved leave requests, then correct or formally document the adjustment.',
  },
  missing_timesheet: {
    label: 'Missing Timesheet',
    icon: FileText,
    meaning: 'An employee has not submitted a timesheet for a week that has already closed.',
    why: 'DCAA requires contemporaneous time recording; unrecorded labor puts contract billing and compliance at risk.',
    action: 'Remind the employee to submit, or enter the time by proxy with documented justification.',
  },
  hours_shortage: {
    label: 'Hours Shortage',
    icon: Clock,
    meaning: 'The hours logged for the week fall short of the expected total, with no approved leave covering the gap.',
    why: 'Total-time accounting requires every working hour to be accounted for; unexplained gaps break that rule.',
    action: 'Have the employee complete the missing hours or submit a leave request that covers them.',
  },
  timesheet_modified_after_certification: {
    label: 'Post-Certification Modification',
    icon: ScrollText,
    meaning: 'A timesheet entry was changed after the employee had already certified the timesheet.',
    why: 'Certification is a signed attestation under the False Claims Act; any later edit invalidates it and requires re-certification.',
    action: 'Investigate the change, require the employee to re-certify, and preserve the audit trail.',
  },
  late_entry_pattern: {
    label: 'Late Entry Pattern',
    icon: AlertTriangle,
    meaning: 'Time was recorded well after the work date (24h+), repeatedly.',
    why: 'Contemporaneous entry is a DCAA cornerstone; habitual late recording undermines timecard reliability.',
    action: 'Counsel the employee on daily entry and monitor whether the pattern continues.',
  },
  missing_accrual: {
    label: 'Missing Accrual',
    icon: BarChart3,
    meaning: 'Leave accrual has not been processed within the expected pay-period cycle.',
    why: 'Skipped accruals understate leave balances and create payroll and leave-liability discrepancies.',
    action: 'Run the accrual process and confirm the last-accrual date advances.',
  },
  policy_unacknowledged: {
    label: 'Policy Not Acknowledged',
    icon: FileSpreadsheet,
    meaning: 'An employee has not acknowledged the current timekeeping policy version.',
    why: 'DCAA expects documented acknowledgment of the timekeeping policy; unacknowledged staff are a compliance gap.',
    action: 'Remind the employee — they will be prompted to acknowledge at next login.',
  },
  proxy_entry_unacknowledged: {
    label: 'Proxy Entry Not Acknowledged',
    icon: UserCheck,
    meaning: "Time entered on an employee's behalf has not yet been confirmed by that employee.",
    why: 'A proxy entry only becomes a valid, attributable record once the employee acknowledges it.',
    action: 'Ask the employee to review and acknowledge the proxy entries on their timesheet.',
  },
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

const dupeKey = (a: AnomalyRow) => `${a.user_id}|${a.anomaly_type}|${a.description}`

// Keep the earliest of each identical (user + type + description) group.
function dedupeLocal(items: AnomalyRow[]): AnomalyRow[] {
  const byAge = [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const seen = new Set<string>()
  const keep: AnomalyRow[] = []
  for (const a of byAge) {
    const key = dupeKey(a)
    if (!seen.has(key)) { seen.add(key); keep.push(a) }
  }
  return keep
}

function countDuplicates(items: AnomalyRow[]): number {
  const seen = new Set<string>()
  let dupes = 0
  for (const a of items) {
    const key = dupeKey(a)
    if (seen.has(key)) dupes++
    else seen.add(key)
  }
  return dupes
}

interface AnomalyFeedProps {
  anomalies: AnomalyRow[]
  resolverId: string
  orgId: string
  canDelete?: boolean
}

export function AnomalyFeed({ anomalies, resolverId, orgId, canDelete = false }: AnomalyFeedProps) {
  const supabase = createClient()
  const [items, setItems] = useState(anomalies)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open')
  const [resolving, setResolving] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [deduping, setDeduping] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const duplicateCount = countDuplicates(items)

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this anomaly? This is recorded in the audit log and cannot be undone.')) return
    setDeleting((d) => ({ ...d, [id]: true }))
    try {
      const res = await fetch(`/api/anomalies/${id}`, { method: 'DELETE' })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Delete failed.')
      setItems((prev) => prev.filter((a) => a.id !== id))
      toast.success('Anomaly deleted.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed.')
    } finally {
      setDeleting((d) => ({ ...d, [id]: false }))
    }
  }

  async function handleDedupe() {
    if (!window.confirm('Remove duplicate anomalies? Keeps the earliest of each identical group. Deletions are recorded in the audit log.')) return
    setDeduping(true)
    try {
      const res = await fetch('/api/anomalies/dedupe', { method: 'POST' })
      const data = await res.json() as { error?: string; removed?: number }
      if (!res.ok) throw new Error(data.error ?? 'Cleanup failed.')
      setItems((prev) => dedupeLocal(prev))
      toast.success(`Removed ${data.removed ?? 0} duplicate ${(data.removed ?? 0) === 1 ? 'anomaly' : 'anomalies'}.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cleanup failed.')
    } finally {
      setDeduping(false)
    }
  }

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
      {/* Filter tabs + bulk cleanup */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex gap-1">
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
        {canDelete && duplicateCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDedupe}
            disabled={deduping}
            className="gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            {deduping ? 'Removing…' : `Remove ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}`}
          </Button>
        )}
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
            const info = TYPE_INFO[anomaly.anomaly_type]
            const TypeIcon = info.icon
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
                      <TypeIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs font-bold tracking-wide">{config.label}</span>
                      <span className="text-xs font-medium">{info.label}</span>
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
                      <div className="mt-3 pt-3 border-t border-current/10 space-y-3 text-xs opacity-90">
                        <div>
                          <p className="font-semibold uppercase tracking-wide opacity-70">What this means</p>
                          <p className="mt-0.5">{info.meaning}</p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wide opacity-70">Why it matters</p>
                          <p className="mt-0.5">{info.why}</p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wide opacity-70">Recommended action</p>
                          <p className="mt-0.5">{info.action}</p>
                        </div>
                        <div className="pt-1 space-y-1 opacity-80">
                          {anomaly.users?.email && (
                            <p><span className="font-medium">Email:</span> {anomaly.users.email}</p>
                          )}
                          <p><span className="font-medium">Status:</span> {anomaly.resolved ? 'Resolved' : 'Open'}</p>
                          {anomaly.resolved_at && (
                            <p><span className="font-medium">Resolved at:</span> {formatDateTime(anomaly.resolved_at)}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [anomaly.id]: !isExpanded }))}
                      className="mt-2 flex items-center gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
                    >
                      {isExpanded ? <><ChevronUp className="h-3 w-3" /> Hide details</> : <><ChevronDown className="h-3 w-3" /> View details</>}
                    </button>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {!anomaly.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolve(anomaly.id)}
                        disabled={resolving[anomaly.id]}
                        className="bg-white hover:bg-white/80"
                      >
                        {resolving[anomaly.id] ? 'Resolving…' : 'Resolve'}
                      </Button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(anomaly.id)}
                        disabled={deleting[anomaly.id]}
                        title="Delete anomaly (recorded in audit log)"
                        className="rounded-md border border-current/20 bg-white/70 p-1.5 text-current/70 hover:text-red-700 hover:border-red-300 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
