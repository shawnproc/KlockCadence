import { Card, CardContent } from '@/components/ui/card'
import { getLeaveTypeLabel } from '@/lib/leave/accrual'
import type { LeaveBalance } from '@/types'

interface LeaveBalanceCardsProps {
  balances: LeaveBalance[]
}

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  if (balances.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No leave balances configured. Contact your administrator.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {balances.map((balance) => {
        const pct =
          balance.accrued_hours > 0
            ? Math.min((balance.available_hours / balance.accrued_hours) * 100, 100)
            : 0
        const isLow = balance.available_hours < 16

        return (
          <Card key={balance.id}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                {getLeaveTypeLabel(balance.leave_type)}
              </p>
              <p className={`text-2xl font-bold tabular-nums ${isLow ? 'text-orange-600' : ''}`}>
                {Number(balance.available_hours).toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
              </p>
              <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{Number(balance.used_hours).toFixed(1)}h used</span>
                <span>{Number(balance.accrued_hours).toFixed(1)}h accrued</span>
              </div>
              {balance.pending_hours > 0 && (
                <p className="text-xs text-yellow-600 mt-1">
                  {Number(balance.pending_hours).toFixed(1)}h pending
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
