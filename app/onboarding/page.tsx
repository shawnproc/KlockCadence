'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Check, ChevronRight } from 'lucide-react'
import Papa from 'papaparse'

const STEPS = [
  { label: 'Org Setup', description: 'Name, fiscal year, holiday schedule' },
  { label: 'Employees', description: 'Bulk import via CSV' },
  { label: 'Leave Policies', description: 'Accrual rates with federal defaults' },
  { label: 'Opening Balances', description: 'Import or enter per employee' },
  { label: 'Charge Codes', description: 'Contract codes setup' },
  { label: 'Done', description: 'First timesheet week is live' },
]

const FEDERAL_DEFAULTS = [
  { leave_type: 'annual', tenure_tier: 'year_0_1', accrual_rate_per_pay_period: 3.0769, max_accrual_hours: 160, carryover_cap_hours: 80 },
  { leave_type: 'annual', tenure_tier: 'year_1_3', accrual_rate_per_pay_period: 4.6154, max_accrual_hours: 200, carryover_cap_hours: 120 },
  { leave_type: 'annual', tenure_tier: 'year_3_5', accrual_rate_per_pay_period: 6.1538, max_accrual_hours: 240, carryover_cap_hours: 160 },
  { leave_type: 'annual', tenure_tier: 'year_5_plus', accrual_rate_per_pay_period: 7.6923, max_accrual_hours: 320, carryover_cap_hours: 200 },
  { leave_type: 'sick', tenure_tier: 'year_0_1', accrual_rate_per_pay_period: 4.0, max_accrual_hours: 240, carryover_cap_hours: 240 },
  { leave_type: 'sick', tenure_tier: 'year_1_3', accrual_rate_per_pay_period: 4.0, max_accrual_hours: 240, carryover_cap_hours: 240 },
  { leave_type: 'sick', tenure_tier: 'year_3_5', accrual_rate_per_pay_period: 4.0, max_accrual_hours: 240, carryover_cap_hours: 240 },
  { leave_type: 'sick', tenure_tier: 'year_5_plus', accrual_rate_per_pay_period: 4.0, max_accrual_hours: 240, carryover_cap_hours: 240 },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [orgData, setOrgData] = useState({ name: '', slug: '', fiscal_year_start: '', holiday_schedule: 'federal' })
  const [orgId, setOrgId] = useState<string | null>(null)
  const [csvEmployees, setCsvEmployees] = useState<unknown[]>([])
  const [policies] = useState(FEDERAL_DEFAULTS)
  const [saving, setSaving] = useState(false)

  async function handleOrgSetup() {
    setSaving(true)
    try {
      const supabase = createClient()
      const slug = orgData.slug || orgData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const { data, error } = await supabase
        .from('organizations')
        .insert({ name: orgData.name, slug, fiscal_year_start: orgData.fiscal_year_start, holiday_schedule: orgData.holiday_schedule })
        .select()
        .single()
      if (error) throw new Error(error.message)
      setOrgId(data.id)
      setStep(1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed.')
    } finally {
      setSaving(false)
    }
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        setCsvEmployees(results.data)
        toast.success(`Parsed ${results.data.length} employees`)
      },
    })
  }

  async function handleEmployeeImport() {
    if (!orgId || csvEmployees.length === 0) { setStep(2); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, employees: csvEmployees }),
      })
      const data = await res.json() as { error?: string; created?: number; skipped?: number; errored?: number }
      if (!res.ok) throw new Error(data.error ?? 'Import failed.')
      toast.success(`${data.created ?? 0} invited · ${data.skipped ?? 0} skipped · ${data.errored ?? 0} errors`)
      setStep(2)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePoliciesSave() {
    if (!orgId) return
    setSaving(true)
    try {
      const supabase = createClient()
      const toInsert = policies.map((p) => ({ ...p, org_id: orgId }))
      const { error } = await supabase.from('leave_policies').upsert(toInsert)
      if (error) throw new Error(error.message)
      setStep(3)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Set Up KlockCadence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete onboarding in under 30 minutes.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium shrink-0 transition-colors ${
                i < step ? 'bg-green-600 text-white' :
                i === step ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-6 ${i < step ? 'bg-green-600' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step]?.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{STEPS[step]?.description}</p>
          </CardHeader>
          <CardContent>
            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Organization Name</Label>
                  <Input value={orgData.name} onChange={(e) => setOrgData((d) => ({ ...d, name: e.target.value }))} placeholder="Acme Federal LLC" />
                </div>
                <div className="space-y-1.5">
                  <Label>URL Slug</Label>
                  <Input value={orgData.slug} onChange={(e) => setOrgData((d) => ({ ...d, slug: e.target.value }))} placeholder="acme-federal (auto-generated if blank)" />
                </div>
                <div className="space-y-1.5">
                  <Label>Fiscal Year Start</Label>
                  <Input type="date" value={orgData.fiscal_year_start} onChange={(e) => setOrgData((d) => ({ ...d, fiscal_year_start: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Holiday Schedule</Label>
                  <select value={orgData.holiday_schedule} onChange={(e) => setOrgData((d) => ({ ...d, holiday_schedule: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-ring focus:outline-none">
                    <option value="federal">Federal</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <Button onClick={handleOrgSetup} disabled={saving || !orgData.name || !orgData.fiscal_year_start}>
                  {saving ? 'Saving…' : 'Continue'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="rounded-md border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload a CSV with columns: <code>full_name, email, role, department, hire_date</code>
                  </p>
                  <input type="file" accept=".csv" onChange={handleCSVUpload} className="text-sm" />
                </div>
                {csvEmployees.length > 0 && (
                  <p className="text-sm text-green-600">{csvEmployees.length} employees ready to import</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleEmployeeImport} disabled={saving}>
                    {csvEmployees.length > 0 ? (saving ? 'Importing…' : 'Import Employees') : 'Skip for Now'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Federal contractor defaults are pre-loaded. Review and confirm or customize.
                </p>
                <div className="text-xs text-muted-foreground space-y-1 border rounded p-3 bg-muted/30">
                  {FEDERAL_DEFAULTS.slice(0, 4).map((p, i) => (
                    <div key={i}>{p.leave_type} / {p.tenure_tier}: {p.accrual_rate_per_pay_period}h/period, max {p.max_accrual_hours}h</div>
                  ))}
                  <div>…and 4 sick leave tiers (4h/period, 240h max)</div>
                </div>
                <Button onClick={handlePoliciesSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Confirm & Continue'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Import opening leave balances via CSV or enter them manually via Admin → Users.
                </p>
                <div className="rounded-md border border-dashed p-6 text-center">
                  <p className="text-xs text-muted-foreground mb-3">
                    CSV columns: <code>email, leave_type, accrued_hours, used_hours</code>
                  </p>
                  <input type="file" accept=".csv" className="text-sm" />
                </div>
                <Button onClick={() => setStep(4)}>
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add your contract charge codes. You can also do this later from Admin → Charge Codes.
                </p>
                <Button onClick={() => setStep(5)}>
                  Go to Charge Codes Setup <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4 text-center py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Setup Complete</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your organization is live. First timesheet week starts now.
                  </p>
                </div>
                <Button onClick={() => router.push('/dashboard')}>
                  Go to Dashboard →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
