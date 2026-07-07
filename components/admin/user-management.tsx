'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { UserPlus, User, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { UserRole } from '@/types'

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000
const MS_PER_7_DAYS = 7 * 24 * 60 * 60 * 1000

interface UserRow {
  id: string
  full_name: string
  email: string
  role: string
  department: string
  hire_date: string
  created_at: string
}

interface AckRecord {
  policy_version: string
  acknowledged_at: string
}

interface UserManagementProps {
  users: UserRow[]
  orgId: string
  currentPolicyVersion: string
  ackMap: Record<string, AckRecord>
}

const ROLES: UserRole[] = ['employee', 'manager', 'admin', 'finance']

function AckStatusBadge({
  userId,
  createdAt,
  currentPolicyVersion,
  ackMap,
}: {
  userId: string
  createdAt: string
  currentPolicyVersion: string
  ackMap: Record<string, AckRecord>
}) {
  const ack = ackMap[userId]
  const now = Date.now()

  if (ack && ack.policy_version === currentPolicyVersion) {
    const ackAge = now - new Date(ack.acknowledged_at).getTime()
    if (ackAge < MS_PER_YEAR) {
      return (
        <div className="flex items-center gap-1 text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Acknowledged</span>
          <span className="text-xs text-muted-foreground ml-1">{formatDate(ack.acknowledged_at)}</span>
        </div>
      )
    }
    // Has acknowledged but > 365 days ago
    return (
      <div className="flex items-center gap-1 text-amber-600">
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs font-medium">Renewal Due</span>
        <span className="text-xs text-muted-foreground ml-1">{formatDate(ack.acknowledged_at)}</span>
      </div>
    )
  }

  // No acknowledgment for current version
  const userAge = now - new Date(createdAt).getTime()
  const isOverdue = userAge > MS_PER_7_DAYS

  return (
    <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
      <AlertTriangle className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{isOverdue ? 'Overdue' : 'Pending'}</span>
    </div>
  )
}

export function UserManagement({ users, orgId, currentPolicyVersion, ackMap }: UserManagementProps) {
  const supabase = createClient()
  const [localUsers, setLocalUsers] = useState(users)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteData, setInviteData] = useState({
    full_name: '', email: '', role: 'employee' as UserRole, department: '', hire_date: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<Record<string, boolean>>({})

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inviteData, org_id: orgId }),
      })
      const data = await res.json() as { error?: string; user?: UserRow }
      if (!res.ok) throw new Error(data.error ?? 'Invite failed.')
      if (data.user) setLocalUsers((u) => [...u, data.user!])
      toast.success(`Invitation sent to ${inviteData.email}`)
      setShowInvite(false)
      setInviteData({ full_name: '', email: '', role: 'employee', department: '', hire_date: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invite failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdatingRole((u) => ({ ...u, [userId]: true }))
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId)
        .eq('org_id', orgId)
      if (error) throw new Error(error.message)
      setLocalUsers((u) => u.map((user) => user.id === userId ? { ...user, role: newRole } : user))
      toast.success('Role updated.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed.')
    } finally {
      setUpdatingRole((u) => ({ ...u, [userId]: false }))
    }
  }

  const overdueCount = localUsers.filter((u) => {
    const ack = ackMap[u.id]
    const now = Date.now()
    const hasValidAck = ack &&
      ack.policy_version === currentPolicyVersion &&
      now - new Date(ack.acknowledged_at).getTime() < MS_PER_YEAR
    return !hasValidAck && now - new Date(u.created_at).getTime() > MS_PER_7_DAYS
  }).length

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{overdueCount} {overdueCount === 1 ? 'employee has' : 'employees have'}</strong>{' '}
            not acknowledged policy v{currentPolicyVersion} within the required 7-day window.
            This will generate compliance anomalies.
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setShowInvite(!showInvite)} size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Invite Employee
        </Button>
      </div>

      {showInvite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite New Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={inviteData.full_name} onChange={(e) => setInviteData((d) => ({ ...d, full_name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={inviteData.email} onChange={(e) => setInviteData((d) => ({ ...d, email: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <select value={inviteData.role} onChange={(e) => setInviteData((d) => ({ ...d, role: e.target.value as UserRole }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-ring focus:outline-none">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input value={inviteData.department} onChange={(e) => setInviteData((d) => ({ ...d, department: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Hire Date</Label>
                <Input type="date" value={inviteData.hire_date} onChange={(e) => setInviteData((d) => ({ ...d, hire_date: e.target.value }))} required />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'Inviting…' : 'Send Invite'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Employee</th>
              <th className="text-left px-4 py-3 font-medium">Department</th>
              <th className="text-left px-4 py-3 font-medium">Hire Date</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Policy Acknowledgment</th>
            </tr>
          </thead>
          <tbody>
            {localUsers.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{u.full_name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.department}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(u.hire_date)}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                    disabled={updatingRole[u.id]}
                    className="h-7 rounded border border-input bg-background px-2 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <AckStatusBadge
                    userId={u.id}
                    createdAt={u.created_at}
                    currentPolicyVersion={currentPolicyVersion}
                    ackMap={ackMap}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Policy acknowledgment version displayed: v{currentPolicyVersion}.
        Employees must acknowledge within 7 days of hire or policy update. Annual re-acknowledgment required.
      </p>
    </div>
  )
}
