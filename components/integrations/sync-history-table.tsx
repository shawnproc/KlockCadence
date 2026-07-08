'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { IntegrationType } from '@/types'

interface SyncEvent {
  id: string
  status: 'success' | 'error' | 'partial'
  records_synced: number
  error_message: string | null
  created_at: string
  users: { full_name: string } | null
}

export function SyncHistoryTable({ integrationType }: { integrationType: IntegrationType }) {
  const [events, setEvents] = useState<SyncEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/integrations/${integrationType}/sync-events`)
      .then((r) => r.json())
      .then((d: { events?: SyncEvent[] }) => {
        setEvents(d.events ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [integrationType])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading history…
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No sync history yet.</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide w-20">Status</th>
            <th className="text-left pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</th>
            <th className="text-right pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Records</th>
            <th className="text-left pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">By</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-1.5">
                  {e.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  {e.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                  {e.status === 'partial' && <AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
                  <span className={`text-xs font-medium capitalize ${
                    e.status === 'success' ? 'text-green-700' :
                    e.status === 'error' ? 'text-red-700' : 'text-orange-700'
                  }`}>{e.status}</span>
                </div>
                {e.error_message && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 max-w-[200px]">{e.error_message}</p>
                )}
              </td>
              <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.created_at)}</td>
              <td className="py-2 pr-4 text-xs text-right font-mono">{e.records_synced}</td>
              <td className="py-2 text-xs text-muted-foreground">{e.users?.full_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
