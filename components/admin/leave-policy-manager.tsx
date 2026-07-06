'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getLeaveTypeLabel } from '@/lib/leave/accrual'
import type { LeavePolicy, TenureTier, LeaveType } from '@/types'

const TIER_LABELS: Record<TenureTier, string> = {
  year_0_1: '0–1 Year',
  year_1_3: '1–3 Years',
  year_3_5: '3–5 Years',
  year_5_plus: '5+ Years',
}

interface LeavePolicyManagerProps {
  policies: LeavePolicy[]
  orgId: string
}

export function LeavePolicyManager({ policies, orgId }: LeavePolicyManagerProps) {
  const supabase = createClient()
  const [edits, setEdits] = useState<Record<string, Partial<LeavePolicy>>>({})
  const [saving, setSaving] = useState(false)

  function updateEdit(id: string, field: keyof LeavePolicy, value: string) {
    setEdits((e) => ({
      ...e,
      [id]: { ...e[id], [field]: parseFloat(value) || 0 },
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      for (const [id, changes] of Object.entries(edits)) {
        const { error } = await supabase
          .from('leave_policies')
          .update(changes)
          .eq('id', id)
          .eq('org_id', orgId)
        if (error) throw new Error(error.message)
      }
      toast.success('Policies saved.')
      setEdits({})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const grouped = policies.reduce<Record<string, LeavePolicy[]>>((acc, p) => {
    const key = p.leave_type
    if (!acc[key]) acc[key] = []
    acc[key]!.push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([type, typePolicies]) => (
        <div key={type}>
          <h3 className="text-sm font-semibold mb-3">{getLeaveTypeLabel(type as LeaveType)}</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium">Tenure</th>
                  <th className="text-left px-4 py-2.5 font-medium">Rate / Pay Period (h)</th>
                  <th className="text-left px-4 py-2.5 font-medium">Max Accrual (h)</th>
                  <th className="text-left px-4 py-2.5 font-medium">Carryover Cap (h)</th>
                </tr>
              </thead>
              <tbody>
                {typePolicies.map((p) => {
                  return (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {TIER_LABELS[p.tenure_tier]}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number" step="0.0001" min="0"
                          defaultValue={p.accrual_rate_per_pay_period}
                          onChange={(ev) => updateEdit(p.id, 'accrual_rate_per_pay_period', ev.target.value)}
                          className="w-24 h-7 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number" step="1" min="0"
                          defaultValue={p.max_accrual_hours}
                          onChange={(ev) => updateEdit(p.id, 'max_accrual_hours', ev.target.value)}
                          className="w-20 h-7 text-xs"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number" step="1" min="0"
                          defaultValue={p.carryover_cap_hours}
                          onChange={(ev) => updateEdit(p.id, 'carryover_cap_hours', ev.target.value)}
                          className="w-20 h-7 text-xs"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {Object.keys(edits).length > 0 && (
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      )}
    </div>
  )
}
