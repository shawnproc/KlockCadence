'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Command } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from './sidebar'
import { NotificationBell } from './notification-bell'
import { CommandPalette } from '@/components/ui/command-palette'
import { PolicyAcknowledgmentModal } from '@/components/policy/policy-acknowledgment-modal'
import { type UserRole } from '@/types'
import { Toaster } from 'sonner'

interface DashboardShellProps {
  children: React.ReactNode
  role: UserRole
  userName: string
  orgName: string
  orgId: string
  userId: string
  requiresAck?: boolean
  policyText?: string
  policyVersion?: string
  isRenewal?: boolean
}

export function DashboardShell({
  children,
  role,
  userName,
  orgName,
  orgId,
  userId,
  requiresAck,
  policyText,
  policyVersion,
  isRenewal,
}: DashboardShellProps) {
  const router = useRouter()
  const supabase = createClient()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {requiresAck && policyText && (
        <PolicyAcknowledgmentModal
          policyText={policyText}
          policyVersion={policyVersion ?? '1.0'}
          orgName={orgName}
          isRenewal={isRenewal}
        />
      )}

      {/* Command palette — mounted once, keyboard-driven */}
      <CommandPalette role={role} />

      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar role={role} userName={userName} orgName={orgName} onSignOut={handleSignOut} />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 md:hidden"
            >
              <Sidebar role={role} userName={userName} orgName={orgName} onSignOut={handleSignOut} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4 md:px-6">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Cmd+K search trigger (desktop) */}
          <button
            onClick={() => {
              const e = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
              window.dispatchEvent(e)
            }}
            className="hidden md:flex items-center gap-2 rounded-lg border bg-muted/60 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Command className="h-3.5 w-3.5" />
            <span>Quick nav…</span>
            <kbd className="ml-2 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
          </button>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            <div
              className="flex h-8 items-center gap-2 rounded-lg px-2"
              style={{ backgroundColor: '#1B2A4A' }}
            >
              <NotificationBell role={role} orgId={orgId} userId={userId} />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
            {children}
          </div>
        </main>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  )
}
