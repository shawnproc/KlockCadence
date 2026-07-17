'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertCircle, Clock } from 'lucide-react'

type Mode = 'join' | 'create'

export default function SignupPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('join')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      if (mode === 'join') {
        const res = await fetch('/api/auth/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: fullName, email, password, company_code: companyCode, admin_password: adminPassword }),
        })
        const data = await res.json() as { error?: string }
        if (!res.ok) throw new Error(data.error ?? 'Sign up failed.')

        const login = await loginAction(email, password)
        if (login.error) throw new Error(login.error)
        router.push('/dashboard')
        router.refresh()
      } else {
        // Create a company: make the account, then finish setup in onboarding.
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName }),
        })
        const data = await res.json() as { error?: string }
        if (!res.ok) throw new Error(data.error ?? 'Sign up failed.')

        const login = await loginAction(email, password)
        if (login.error) throw new Error(login.error)
        router.push('/onboarding')
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1B2A4A' }}>
      <div className="w-full max-w-sm px-4">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Clock className="h-8 w-8 text-white" />
          <div>
            <div className="text-white font-bold text-2xl tracking-tight">KlockCadence</div>
            <div className="text-white/50 text-xs">Keystone Operations Group LLC</div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              {mode === 'join' ? 'Join your company on KlockCadence' : 'Set up a new company on KlockCadence'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mode toggle */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {(['join', 'create'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null) }}
                  className={cn(
                    'rounded px-2 py-1.5 text-xs font-medium transition-colors',
                    mode === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {m === 'join' ? 'Join a company' : 'Create a company'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Work Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.gov" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
              </div>

              {mode === 'join' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="companyCode">Company Code</Label>
                    <Input id="companyCode" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} placeholder="From your administrator" required className="font-mono uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="adminPassword">Admin Password <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="adminPassword" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} autoComplete="off" />
                    <p className="text-xs text-muted-foreground">Leave blank if you&rsquo;re a regular employee.</p>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account…' : (mode === 'join' ? 'Join company' : 'Continue to setup')}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
