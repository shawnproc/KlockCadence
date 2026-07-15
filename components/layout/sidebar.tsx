'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { type UserRole } from '@/types'
import {
  Clock,
  Calendar,
  AlertTriangle,
  BarChart3,
  Settings,
  Users,
  Home,
  ScrollText,
  Building2,
  LogOut,
  UserCheck,
  FileSpreadsheet,
  Shield,
  Command,
  ClipboardCheck,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, roles: ['employee', 'manager', 'admin', 'finance'] },
  { href: '/timesheets', label: 'Timesheets', icon: Clock, roles: ['employee', 'manager', 'admin', 'finance'] },
  { href: '/leave', label: 'Leave', icon: Calendar, roles: ['employee', 'manager', 'admin', 'finance'] },
  { href: '/timesheets/approvals', label: 'Approvals', icon: ClipboardCheck, roles: ['manager', 'admin'] },
  { href: '/timesheets/proxy', label: 'Proxy Entry', icon: UserCheck, roles: ['manager', 'admin'] },
  { href: '/anomalies', label: 'Anomalies', icon: AlertTriangle, roles: ['manager', 'admin', 'finance'] },
  { href: '/reports', label: 'DCAA Reports', icon: BarChart3, roles: ['admin', 'finance'] },
  { href: '/reports/labor-distribution', label: 'Labor Distribution', icon: FileSpreadsheet, roles: ['admin', 'finance'] },
  { href: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['admin'] },
  { href: '/admin/users', label: 'Users', icon: Users, roles: ['admin'] },
  { href: '/admin/charge-codes', label: 'Charge Codes', icon: Building2, roles: ['admin'] },
  { href: '/admin/policy', label: 'Policy Manager', icon: Shield, roles: ['admin'] },
  { href: '/admin/org', label: 'Org Settings', icon: Settings, roles: ['admin'] },
]

interface SidebarProps {
  role: UserRole
  userName: string
  orgName: string
  onSignOut: () => void
}

export function Sidebar({ role, userName, orgName, onSignOut }: SidebarProps) {
  const pathname = usePathname()
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  function openCommandPalette() {
    const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    window.dispatchEvent(e)
  }

  return (
    <aside className="flex h-screen w-60 flex-col shrink-0" style={{ backgroundColor: '#1B2A4A' }}>
      {/* Logo / Org */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-white font-bold text-lg tracking-tight">KlockCadence</div>
        <div className="text-white/50 text-xs mt-0.5 truncate">{orgName}</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                isActive
                  ? 'bg-white/15 text-white font-semibold shadow-sm'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-all',
                  isActive ? 'text-white' : 'text-white/50'
                )}
              />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70 shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Cmd+K hint */}
      <button
        onClick={openCommandPalette}
        className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/40 hover:border-white/20 hover:text-white/60 transition-colors"
      >
        <Command className="h-3.5 w-3.5" />
        <span>Quick nav</span>
        <kbd className="ml-auto rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[9px] font-medium tracking-wide">
          ⌘K
        </kbd>
      </button>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <div className="text-white text-sm font-medium truncate">{userName}</div>
          <div className="text-white/50 text-xs capitalize">{role}</div>
        </div>
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/65 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
