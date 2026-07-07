'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, AlertTriangle, Clock, CheckCircle, X } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface NotificationItem {
  id: string
  type: 'anomaly' | 'timesheet'
  title: string
  body: string
  href: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  createdAt: string
}

interface NotificationBellProps {
  role: UserRole
  orgId: string
  userId: string
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-500',
  low: 'text-blue-500',
}

export function NotificationBell({ role, orgId, userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const canSeeAnomalies = ['manager', 'admin', 'finance'].includes(role)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    const results: NotificationItem[] = []

    if (canSeeAnomalies) {
      const { data: anomalies } = await supabase
        .from('anomalies')
        .select('id, anomaly_type, severity, description, created_at')
        .eq('org_id', orgId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(5)

      for (const a of anomalies ?? []) {
        results.push({
          id: `anomaly-${a.id}`,
          type: 'anomaly',
          title: formatAnomalyType(a.anomaly_type as string),
          body: a.description as string,
          href: '/anomalies',
          severity: a.severity as NotificationItem['severity'],
          createdAt: a.created_at as string,
        })
      }
    }

    // Pending proxy ack for employee
    const { data: proxyEntries } = await supabase
      .from('timesheet_entries')
      .select('id, work_date')
      .eq('user_id', userId)
      .eq('is_proxy_entry', true)
      .eq('employee_acknowledged', false)
      .limit(3)

    if ((proxyEntries?.length ?? 0) > 0) {
      results.push({
        id: 'proxy-ack',
        type: 'timesheet',
        title: 'Proxy Entries Need Acknowledgment',
        body: `${proxyEntries!.length} entr${proxyEntries!.length === 1 ? 'y was' : 'ies were'} entered on your behalf`,
        href: '/timesheets',
        createdAt: proxyEntries![0]!.work_date as string,
      })
    }

    results.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    setItems(results)
    setLoading(false)
  }, [canSeeAnomalies, orgId, userId, supabase])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const unreadCount = items.length

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
            <span className="animate-badge-pulse absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border bg-white"
            style={{ boxShadow: 'var(--shadow-popover)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-72 overflow-y-auto">
              {loading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-10 rounded-lg" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
                  <p className="text-sm font-medium">All clear</p>
                  <p className="text-xs text-muted-foreground">No pending alerts</p>
                </div>
              ) : (
                <div className="divide-y">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="mt-0.5 shrink-0">
                        {item.type === 'anomaly' ? (
                          <AlertTriangle className={`h-4 w-4 ${item.severity ? SEVERITY_COLOR[item.severity] : 'text-muted-foreground'}`} />
                        ) : (
                          <Clock className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t px-4 py-2">
                <Link
                  href={canSeeAnomalies ? '/anomalies' : '/timesheets'}
                  onClick={() => setOpen(false)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  View all →
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function formatAnomalyType(type: string): string {
  return type
    .split('_')
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ')
}
