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
  FileText,
  Home,
  ScrollText,
  Building2,
  LogOut,
  UserCheck,
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
  { href: '/leave/requests', label: 'Leave Requests', icon: FileText, roles: ['manager', 'admin'] },
  { href: '/timesheets/proxy', label: 'Proxy Entry', icon: UserCheck, roles: ['manager', 'admin'] },
  { href: '/anomalies', label: 'Anomalies', icon: AlertTriangle, roles: ['manager', 'admin', 'finance'] },
  { href: '/reports', label: 'DCAA Reports', icon: BarChart3, roles: ['admin', 'finance'] },
  { href: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['admin'] },
  { href: '/admin/users', label: 'Users', icon: Users, roles: ['admin'] },
  { href: '/admin/charge-codes', label: 'Charge Codes', icon: Building2, roles: ['admin'] },
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

  return (
    <aside className="flex h-screen w-60 flex-col" style={{ backgroundColor: '#1B2A4A' }}>
      {/* Logo / Org */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="text-white font-bold text-lg tracking-tight">KlockCadence</div>
        <div className="text-white/50 text-xs mt-0.5 truncate">{orgName}</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-1">
          <div className="text-white text-sm font-medium truncate">{userName}</div>
          <div className="text-white/50 text-xs capitalize">{role}</div>
        </div>
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-white/65 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
