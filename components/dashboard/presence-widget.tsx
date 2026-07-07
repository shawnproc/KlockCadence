import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmployeeStatus {
  id: string
  full_name: string
  department: string
  active_today: boolean
}

interface PresenceWidgetProps {
  employees: EmployeeStatus[]
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export function PresenceWidget({ employees }: PresenceWidgetProps) {
  const activeCount = employees.filter((e) => e.active_today).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Team Presence
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {activeCount} of {employees.length} active today
        </p>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No employees found.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center gap-2.5">
                <div className="h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                  {initials(emp.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{emp.full_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{emp.department}</p>
                </div>
                <div className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  emp.active_today ? 'bg-green-500' : 'bg-gray-300'
                )} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
