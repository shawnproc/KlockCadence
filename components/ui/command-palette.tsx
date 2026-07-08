'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Clock, Calendar, AlertTriangle, BarChart3, Users, FileText,
  ScrollText, Building2, Settings, UserCheck, FileSpreadsheet, Shield,
  Search, ArrowRight, Command, Plug,
} from 'lucide-react'
import type { UserRole } from '@/types'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  roles: UserRole[]
  group: 'Navigate' | 'Actions'
  keywords?: string[]
}

const ALL_COMMANDS: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/dashboard', roles: ['employee', 'manager', 'admin', 'finance'], group: 'Navigate' },
  { id: 'timesheets', label: 'Timesheets', description: 'View and submit your timesheet', icon: Clock, href: '/timesheets', roles: ['employee', 'manager', 'admin', 'finance'], group: 'Navigate', keywords: ['time', 'hours'] },
  { id: 'leave', label: 'Leave', description: 'View your leave balances', icon: Calendar, href: '/leave', roles: ['employee', 'manager', 'admin', 'finance'], group: 'Navigate', keywords: ['pto', 'vacation', 'sick'] },
  { id: 'leave-requests', label: 'Leave Requests', description: 'Review pending requests', icon: FileText, href: '/leave/requests', roles: ['manager', 'admin'], group: 'Navigate' },
  { id: 'proxy-entry', label: 'Proxy Entry', description: 'Enter time on behalf of employee', icon: UserCheck, href: '/timesheets/proxy', roles: ['manager', 'admin'], group: 'Actions', keywords: ['proxy', 'absence'] },
  { id: 'anomalies', label: 'Anomalies', description: 'View compliance alerts', icon: AlertTriangle, href: '/anomalies', roles: ['manager', 'admin', 'finance'], group: 'Navigate', keywords: ['alerts', 'compliance', 'issues'] },
  { id: 'reports', label: 'DCAA Reports', description: 'Generate audit packages', icon: BarChart3, href: '/reports', roles: ['admin', 'finance'], group: 'Navigate', keywords: ['dcaa', 'audit', 'pdf'] },
  { id: 'labor-distribution', label: 'Labor Distribution', description: 'Monthly GL report → QuickBooks', icon: FileSpreadsheet, href: '/reports/labor-distribution', roles: ['admin', 'finance'], group: 'Navigate', keywords: ['gl', 'payroll', 'csv', 'quickbooks'] },
  { id: 'audit-log', label: 'Audit Log', description: 'Immutable activity trail', icon: ScrollText, href: '/audit', roles: ['admin'], group: 'Navigate' },
  { id: 'users', label: 'Users', description: 'Manage team members', icon: Users, href: '/admin/users', roles: ['admin'], group: 'Navigate' },
  { id: 'charge-codes', label: 'Charge Codes', description: 'Manage contract codes', icon: Building2, href: '/admin/charge-codes', roles: ['admin'], group: 'Navigate' },
  { id: 'policy-manager', label: 'Policy Manager', description: 'Generate & publish policy versions', icon: Shield, href: '/admin/policy', roles: ['admin'], group: 'Actions', keywords: ['policy', 'dcaa', 'pdf'] },
  { id: 'integrations', label: 'Integrations', description: 'QuickBooks, Gusto, ADP, Xero, Sage, Deltek', icon: Plug, href: '/admin/integrations', roles: ['admin'], group: 'Navigate', keywords: ['quickbooks', 'gusto', 'adp', 'xero', 'sync', 'payroll'] },
  { id: 'org-settings', label: 'Org Settings', description: 'Organization configuration', icon: Settings, href: '/admin/org', roles: ['admin'], group: 'Navigate' },
]

interface CommandPaletteProps {
  role: UserRole
}

export function CommandPalette({ role }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const roleCommands = ALL_COMMANDS.filter((c) => c.roles.includes(role))

  const filtered = query.trim()
    ? roleCommands.filter((c) => {
        const q = query.toLowerCase()
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q))
        )
      })
    : roleCommands

  // Group by 'Navigate' then 'Actions'
  const navigateItems = filtered.filter((c) => c.group === 'Navigate')
  const actionItems = filtered.filter((c) => c.group === 'Actions')
  const displayItems = [...navigateItems, ...actionItems]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
        setSelectedIdx(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(i + 1, displayItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const item = displayItems[selectedIdx]
      if (item) { router.push(item.href); setOpen(false) }
    }
  }

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-1/2 top-[15vh] z-[101] w-full max-w-xl -translate-x-1/2"
              style={{ boxShadow: 'var(--shadow-command)' }}
            >
              <div className="overflow-hidden rounded-xl border bg-white">
                {/* Search input */}
                <div className="flex items-center gap-3 border-b px-4 py-3">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search pages and actions…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <kbd className="flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto py-2">
                  {displayItems.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
                  ) : (
                    <>
                      {navigateItems.length > 0 && (
                        <div>
                          <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Navigate</p>
                          {navigateItems.map((item) => {
                            const globalIdx = displayItems.indexOf(item)
                            const Icon = item.icon
                            return (
                              <button
                                key={item.id}
                                onClick={() => navigate(item.href)}
                                onMouseEnter={() => setSelectedIdx(globalIdx)}
                                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                  selectedIdx === globalIdx ? 'bg-muted' : 'hover:bg-muted/50'
                                }`}
                              >
                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">{item.label}</div>
                                  {item.description && (
                                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                                  )}
                                </div>
                                {selectedIdx === globalIdx && (
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {actionItems.length > 0 && (
                        <div>
                          <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Actions</p>
                          {actionItems.map((item) => {
                            const globalIdx = displayItems.indexOf(item)
                            const Icon = item.icon
                            return (
                              <button
                                key={item.id}
                                onClick={() => navigate(item.href)}
                                onMouseEnter={() => setSelectedIdx(globalIdx)}
                                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                  selectedIdx === globalIdx ? 'bg-muted' : 'hover:bg-muted/50'
                                }`}
                              >
                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">{item.label}</div>
                                  {item.description && (
                                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                                  )}
                                </div>
                                {selectedIdx === globalIdx && (
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><kbd className="rounded border px-1 py-0.5 bg-muted">↑↓</kbd> navigate</span>
                    <span className="flex items-center gap-1"><kbd className="rounded border px-1 py-0.5 bg-muted">↵</kbd> open</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Command className="h-3 w-3" />K
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Trigger hint in sidebar footer (rendered separately by Sidebar) */}
    </>
  )
}
