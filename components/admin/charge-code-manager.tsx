'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import type { ChargeCode } from '@/types'

const COMMON_CODES = [
  { code: 'G&A-OVERHEAD', description: 'General & Administrative / Overhead', is_billable: false },
  { code: 'B&P', description: 'Bid and Proposal', is_billable: false },
  { code: 'IR&D', description: 'Independent Research & Development', is_billable: false },
  { code: 'FRINGE', description: 'Fringe Benefits', is_billable: false },
]

interface ChargeCodeManagerProps {
  codes: ChargeCode[]
  orgId: string
}

export function ChargeCodeManager({ codes, orgId }: ChargeCodeManagerProps) {
  const supabase = createClient()
  const [localCodes, setLocalCodes] = useState(codes)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    code: '', description: '', contract_number: '', is_billable: true
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('charge_codes')
        .insert({
          org_id: orgId,
          code: form.code.trim(),
          description: form.description.trim(),
          contract_number: form.contract_number.trim() || null,
          is_billable: form.is_billable,
          is_active: true,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      setLocalCodes((c) => [...c, data])
      toast.success('Charge code added.')
      setForm({ code: '', description: '', contract_number: '', is_billable: true })
      setShowForm(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add.')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase
      .from('charge_codes')
      .update({ is_active: !current })
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) { toast.error('Update failed.'); return }
    setLocalCodes((c) => c.map((code) => code.id === id ? { ...code, is_active: !current } : code))
  }

  function applySuggestion(s: typeof COMMON_CODES[0]) {
    setForm({ code: s.code, description: s.description, contract_number: '', is_billable: s.is_billable })
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Add Charge Code
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Charge Code</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3">
              <p className="text-xs text-muted-foreground mb-2">Common suggestions:</p>
              <div className="flex gap-2 flex-wrap">
                {COMMON_CODES.filter((s) => !localCodes.find((c) => c.code === s.code)).map((s) => (
                  <button key={s.code} onClick={() => applySuggestion(s)}
                    className="text-xs border rounded px-2 py-1 hover:bg-muted transition-colors">
                    {s.code}
                  </button>
                ))}
              </div>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. N00024-23-C-6301" required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Contract description" required />
              </div>
              <div className="space-y-1.5">
                <Label>Contract Number (optional)</Label>
                <Input value={form.contract_number} onChange={(e) => setForm((f) => ({ ...f, contract_number: e.target.value }))} placeholder="Contract #" />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_billable} onChange={(e) => setForm((f) => ({ ...f, is_billable: e.target.checked }))} className="rounded" />
                  Billable
                </label>
              </div>
              <div className="col-span-2 flex gap-2">
                <Button type="submit" size="sm" disabled={submitting}>{submitting ? 'Adding…' : 'Add Code'}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">Code</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
              <th className="text-left px-4 py-3 font-medium">Contract #</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {localCodes.map((code) => (
              <tr key={code.id} className={`border-t ${!code.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs">{code.code}</td>
                <td className="px-4 py-3">{code.description}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{code.contract_number ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={code.is_billable ? 'default' : 'secondary'}>
                    {code.is_billable ? 'Billable' : 'Non-billable'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={code.is_active ? 'approved' : 'outline'}>
                    {code.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(code.id, code.is_active)}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    {code.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
