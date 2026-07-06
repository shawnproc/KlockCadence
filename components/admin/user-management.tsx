'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { UserPlus, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { UserRole } from '@/types'

interface UserRow {
  id: string
  full_name: string
  email: string
  role: string
  department: string
  hire_date: string
  created_at: string
}

interface UserManagementProps {
  users: UserRow[]
  orgId: string
}

const ROLES: UserRole[] = ['employee', 'manager', 'admin', 'finance']

export function UserManagement({ users, orgId }: UserManagementProps) {
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

  return (
    <div className="space-y-4">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
