import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

interface AuditPageProps {
  searchParams: Promise<{ user?: string; action?: string; from?: string; to?: string }>
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, org_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const params = await searchParams

  const query = supabase
    .from('audit_log')
    .select('id, action, target_table, target_id, ip_address, created_at, actor:actor_id(full_name, email)')
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (params.action) query.eq('action', params.action)
  if (params.from) query.gte('created_at', params.from)
  if (params.to) query.lte('created_at', params.to + 'T23:59:59Z')

  const { data: logs } = await query

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Immutable — every action recorded permanently. No edits or deletions permitted.
        </p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Timestamp</th>
              <th className="text-left px-4 py-3 font-medium">Action</th>
              <th className="text-left px-4 py-3 font-medium">Actor</th>
              <th className="text-left px-4 py-3 font-medium">Target</th>
              <th className="text-left px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs?.map((log) => {
              const actor = log.actor as { full_name: string; email: string } | null
              return (
                <tr key={log.id} className="border-t hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-xs font-mono">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">{actor?.full_name ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">
                    {log.target_table}/{log.target_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{log.ip_address || '—'}</td>
                </tr>
              )
            })}
            {(!logs || logs.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No audit entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
