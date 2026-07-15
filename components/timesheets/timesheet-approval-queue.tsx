'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatWeekRange, formatDate, formatDateTime } from '@/lib/utils'
import { CheckCircle, XCircle, User, Clock, ChevronDown, ChevronUp } from 'lucide-react'

export interface PendingTimesheet {
  id: string
  employee_name: string
  email: string
  department: string
  week_start_date: string
  certified_at: string | null
  total_hours: number
  entries: {
    work_date: string
    hours: number
    work_description: string
    is_proxy_entry: boolean
    charge_code: string
    charge_description: string
  }[]
}

interface Props {
  timesheets: PendingTimesheet[]
}

export function TimesheetApprovalQueue({ timesheets }: Props) {
  const [items, setItems] = useState(timesheets)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [rejecting, setRejecting] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

  async function decide(id: string, decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && (reason[id] ?? '').trim().length < 5) {
      toast.error('Enter a rejection reason (the employee will see it).')
      return
    }
    setProcessing((p) => ({ ...p, [id]: true }))
    try {
      const res = await fetch(`/api/timesheets/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason[id] ?? '' }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Action failed.')
      setItems((prev) => prev.filter((t) => t.id !== id))
      toast.success(decision === 'approved' ? 'Timesheet approved.' : 'Timesheet rejected.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setProcessing((p) => ({ ...p, [id]: false }))
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-green-500" />
        <p className="mt-2 font-medium text-green-700">No timesheets awaiting approval</p>
        <p className="text-sm text-muted-foreground">You&rsquo;re all caught up.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((ts) => {
        const isOpen = expanded[ts.id] ?? false
        return (
          <Card key={ts.id}>
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{ts.employee_name}</span>
                    {ts.department && <span className="text-xs text-muted-foreground">{ts.department}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{formatWeekRange(ts.week_start_date)}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {ts.total_hours.toFixed(2)}h
                    </span>
                    {ts.certified_at && (
                      <span className="text-xs">Certified {formatDateTime(ts.certified_at)}</span>
                    )}
                  </div>
                </div>
                <Badge variant="secondary">submitted</Badge>
              </div>

              <button
                onClick={() => setExpanded((e) => ({ ...e, [ts.id]: !isOpen }))}
                className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {isOpen ? <><ChevronUp className="h-3.5 w-3.5" /> Hide entries</> : <><ChevronDown className="h-3.5 w-3.5" /> Review {ts.entries.length} entries</>}
              </button>

              {isOpen && (
                <div className="mt-3 rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Charge Code</th>
                        <th className="px-3 py-2 font-medium text-right">Hours</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ts.entries.map((e, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDate(e.work_date)}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium">{e.charge_code}</span>
                            {e.is_proxy_entry && <span className="ml-1 text-orange-600">(proxy)</span>}
                          </td>
                          <td className="px-3 py-2 text-right">{e.hours.toFixed(2)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{e.work_description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rejecting[ts.id] && (
                <Textarea
                  placeholder="Reason for rejection (shown to the employee)"
                  value={reason[ts.id] ?? ''}
                  onChange={(ev) => setReason((r) => ({ ...r, [ts.id]: ev.target.value }))}
                  rows={2}
                  className="mt-3 text-sm"
                />
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => decide(ts.id, 'approved')}
                  disabled={processing[ts.id]}
                  className="gap-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve
                </Button>
                {rejecting[ts.id] ? (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decide(ts.id, 'rejected')}
                      disabled={processing[ts.id]}
                      className="gap-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Confirm rejection
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejecting((r) => ({ ...r, [ts.id]: false }))}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejecting((r) => ({ ...r, [ts.id]: true }))}
                    disabled={processing[ts.id]}
                    className="gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
