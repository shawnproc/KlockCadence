'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from './sidebar'
import { type UserRole } from '@/types'
import { Toaster } from 'sonner'

interface DashboardShellProps {
  children: React.ReactNode
  role: UserRole
  userName: string
  orgName: string
}

export function DashboardShell({ children, role, userName, orgName }: DashboardShellProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex h-screen overflow-hidden">
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
