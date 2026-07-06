'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateLeaveRequestBalance } from '@/lib/dcaa/validators'
import { getLeaveTypeLabel } from '@/lib/leave/accrual'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { LeaveBalance, LeaveType } from '@/types'

interface LeaveRequestFormProps {
  orgId: string
  userId: string
  balances: LeaveBalance[]
}

const LEAVE_TYPES: LeaveType[] = ['annual', 'sick', 'comp', 'jury_duty', 'bereavement', 'fmla', 'unpaid']

export function LeaveRequestForm({ orgId, userId, balances }: LeaveRequestFormProps) {
  const supabase = createClient()
  const [leaveType, setLeaveType] = useState<LeaveType>('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedBalance = balances.find((b) => b.leave_type === leaveType)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!startDate || !endDate || !hours) return

    const requestedHours = parseFloat(hours)
    if (isNaN(requestedHours) || requestedHours <= 0) {
      toast.error('Enter a valid number of hours.')
      return
    }

    if (selectedBalance) {
      const validation = validateLeaveRequestBalance(selectedBalance, { requested_hours: requestedHours })
      if (!validation.valid) {
        toast.error(validation.errors[0] ?? 'Insufficient balance.')
        return
      }
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('leave_requests').insert({
        org_id: orgId,
        user_id: userId,
        leave_type: leaveType,
        requested_hours: requestedHours,
        start_date: startDate,
        end_date: endDate,
        employee_notes: notes || null,
        status: 'pending',
      })

      if (error) throw new Error(error.message)

      toast.success('Leave request submitted.')
      setStartDate('')
      setEndDate('')
      setHours('')
      setNotes('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Request Leave</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Leave Type</Label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {getLeaveTypeLabel(t)}
                  {balances.find((b) => b.leave_type === t)
                    ? ` (${Number(balances.find((b) => b.leave_type === t)?.available_hours).toFixed(1)}h available)`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Hours Requested</Label>
            <Input
              type="number"
              min="0.25"
              step="0.25"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 8"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason or additional context"
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
