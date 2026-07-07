'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from './sidebar'
import { PolicyAcknowledgmentModal } from '@/components/policy/policy-acknowledgment-modal'
import { type UserRole } from '@/types'
import { Toaster } from 'sonner'

interface DashboardShellProps {
  children: React.ReactNode
  role: UserRole
  userName: string
  orgName: string
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
  requiresAck,
  policyText,
  policyVersion,
  isRenewal,
}: DashboardShellProps) {
  const router = useRouter()
  const supabase = createClient()

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
      <Sidebar role={role} userName={userName} orgName={orgName} onSignOut={handleSignOut} />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="container mx-auto max-w-7xl px-6 py-8">
          {children}
        </div>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  )
}
