'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { getLeaveTypeLabel } from '@/lib/leave/accrual'
import { formatDate } from '@/lib/utils'
import { CheckCircle, XCircle, User, Calendar, Clock } from 'lucide-react'

interface LeaveRequestRow {
  id: string
  leave_type: string
  requested_hours: number
  start_date: string
  end_date: string
  status: string
  employee_notes: string | null
  reviewer_notes: string | null
  created_at: string
  users: { full_name: string; email: string; department: string } | null
}

interface LeaveApprovalQueueProps {
  requests: LeaveRequestRow[]
  reviewerId: string
  orgId: string
}

export function LeaveApprovalQueue({ requests, reviewerId, orgId }: LeaveApprovalQueueProps) {
  const supabase = createClient()
  const [localRequests, setLocalRequests] = useState(requests)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

  async function handleDecision(requestId: string, decision: 'approved' | 'denied') {
    setProcessing((p) => ({ ...p, [requestId]: true }))
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: decision,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: notes[requestId] ?? null,
        })
        .eq('id', requestId)
        .eq('org_id', orgId)

      if (error) throw new Error(error.message)

      // If approved, update pending_hours on leave_balance
      if (decision === 'approved') {
        const req = localRequests.find((r) => r.id === requestId)
        if (req) {
          const { data: balance } = await supabase
            .from('leave_balances')
            .select('id, used_hours, pending_hours')
            .eq('org_id', orgId)
            .single()

          if (balance) {
            await supabase
              .from('leave_balances')
              .update({
                used_hours: Number(balance.used_hours) + req.requested_hours,
                pending_hours: Math.max(0, Number(balance.pending_hours) - req.requested_hours),
              })
              .eq('id', balance.id)
          }
        }
      }

      setLocalRequests((prev) => prev.filter((r) => r.id !== requestId))
      toast.success(`Request ${decision}.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setProcessing((p) => ({ ...p, [requestId]: false }))
    }
  }

  if (localRequests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        No pending leave requests.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {localRequests.map((req) => {
        const u = req.users
        return (
          <Card key={req.id}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{u?.full_name}</span>
                    <span className="text-xs text-muted-foreground">{u?.department}</span>
                    <Badge variant="secondary">{getLeaveTypeLabel(req.leave_type as never)}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(req.start_date)} – {formatDate(req.end_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {req.requested_hours}h
                    </span>
                  </div>
                  {req.employee_notes && (
                    <p className="text-sm text-muted-foreground italic">
                      &ldquo;{req.employee_notes}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Textarea
                  placeholder="Reviewer notes (optional)"
                  value={notes[req.id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [req.id]: e.target.value }))}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleDecision(req.id, 'approved')}
                    disabled={processing[req.id]}
                    className="gap-1.5"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDecision(req.id, 'denied')}
                    disabled={processing[req.id]}
                    className="gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Deny
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
