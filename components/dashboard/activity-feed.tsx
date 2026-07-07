import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'

export interface ActivityEntry {
  id: string
  action: string
  created_at: string
  new_value: Record<string, unknown> | null
  actor: { full_name: string } | null
}

function toPlainEnglish(entry: ActivityEntry): { text: string; isAlert: boolean } {
  const name = entry.actor?.full_name ?? 'System'
  const a = entry.action
  const v = entry.new_value

  if (a === 'TIMESHEET_SUBMITTED') return { text: `${name} submitted a timesheet`, isAlert: false }
  if (a === 'TIMESHEET_APPROVED') return { text: `${name} approved a timesheet`, isAlert: false }
  if (a === 'TIMESHEET_REJECTED') return { text: `${name} rejected a timesheet`, isAlert: true }
  if (a === 'TIMESHEET_CERTIFIED') {
    if (v && typeof v === 'object' && (v as Record<string, unknown>).action === 'DCAA_AUDIT_PACKAGE_EXPORTED') {
      return { text: `${name} generated a DCAA audit package`, isAlert: false }
    }
    return { text: `${name} certified a timesheet`, isAlert: false }
  }
  if (a === 'LEAVE_REQUEST_SUBMITTED') return { text: `${name} submitted a leave request`, isAlert: false }
  if (a === 'LEAVE_REQUEST_APPROVED') return { text: `${name} approved a leave request`, isAlert: false }
  if (a === 'LEAVE_REQUEST_DENIED') return { text: `${name} denied a leave request`, isAlert: true }
  if (a === 'LEAVE_REQUEST_CANCELLED') return { text: `${name} cancelled a leave request`, isAlert: false }
  if (a === 'ANOMALY_RESOLVED') return { text: `${name} resolved a compliance anomaly`, isAlert: false }
  if (a === 'BALANCE_MODIFIED') return { text: 'Leave balance modified — compliance review required', isAlert: true }
  if (a === 'USER_CREATED') return { text: `${name} added a new employee`, isAlert: false }
  if (a === 'USER_ROLE_CHANGED') return { text: `${name} changed an employee role`, isAlert: true }
  if (a === 'USER_DEACTIVATED') return { text: `${name} deactivated a user`, isAlert: true }
  if (a === 'CHARGE_CODE_CREATED') return { text: `${name} created a charge code`, isAlert: false }
  if (a === 'ORG_SETTINGS_UPDATED') return { text: `${name} updated organization settings`, isAlert: false }
  if (a === 'CERTIFICATION_SIGNED') return { text: `${name} signed an employee certification`, isAlert: false }
  if (a === 'LEAVE_POLICY_UPDATED') return { text: `${name} updated a leave policy`, isAlert: false }

  return { text: `${name} — ${a.toLowerCase().replace(/_/g, ' ')}`, isAlert: false }
}

interface ActivityFeedProps {
  entries: ActivityEntry[]
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map((entry) => {
            const { text, isAlert } = toPlainEnglish(entry)
            return (
              <div key={entry.id} className="flex items-start gap-3">
                <div className={cn(
                  'h-1.5 w-1.5 rounded-full mt-1.5 shrink-0',
                  isAlert ? 'bg-red-500' : 'bg-blue-400'
                )} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm leading-snug', isAlert ? 'text-red-700 font-medium' : '')}>{text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(entry.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
