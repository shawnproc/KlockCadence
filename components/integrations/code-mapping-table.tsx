'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { IntegrationType } from '@/types'
import { INTEGRATION_META } from './meta'

interface ChargeCode {
  id: string
  code: string
  description: string
  is_billable: boolean
}

interface MappingRow {
  charge_code_id: string
  external_code: string
  external_name: string
}

interface Props {
  integrationType: IntegrationType
  chargeCodes: ChargeCode[]
}

export function CodeMappingTable({ integrationType, chargeCodes }: Props) {
  const [rows, setRows] = useState<MappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const meta = INTEGRATION_META[integrationType]

  useEffect(() => {
    fetch(`/api/integrations/${integrationType}/code-mappings`)
      .then((r) => r.json())
      .then((d: { mappings?: { charge_code_id: string; external_code: string; external_name: string | null }[] }) => {
        const existing = new Map(
          (d.mappings ?? []).map((m) => [m.charge_code_id, { external_code: m.external_code, external_name: m.external_name ?? '' }])
        )
        setRows(
          chargeCodes.map((c) => ({
            charge_code_id: c.id,
            external_code: existing.get(c.id)?.external_code ?? '',
            external_name: existing.get(c.id)?.external_name ?? '',
          }))
        )
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [integrationType, chargeCodes])

  function updateRow(id: string, field: 'external_code' | 'external_name', value: string) {
    setRows((prev) => prev.map((r) => (r.charge_code_id === id ? { ...r, [field]: value } : r)))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/integrations/${integrationType}/code-mappings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: rows.filter((r) => r.external_code) }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Charge code mappings saved.')
    } catch {
      toast.error('Failed to save mappings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Map each KlockCadence charge code to its {meta.name} equivalent.
        {meta.codeHint && <span className="font-medium"> Field format: {meta.codeHint}.</span>}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">KC Code</th>
              <th className="text-left pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">{meta.name} Code</th>
              <th className="text-left pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Display Name</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cc = chargeCodes.find((c) => c.id === row.charge_code_id)!
              return (
                <tr key={row.charge_code_id} className="border-t">
                  <td className="py-2 pr-4">
                    <div className="text-sm font-medium font-mono">{cc.code}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{cc.description}</div>
                    <span className={`text-[10px] font-medium ${cc.is_billable ? 'text-green-600' : 'text-slate-500'}`}>
                      {cc.is_billable ? 'Billable' : 'Indirect'}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      value={row.external_code}
                      onChange={(e) => updateRow(row.charge_code_id, 'external_code', e.target.value)}
                      placeholder="External code"
                      className="w-full rounded-md border px-2 py-1 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="text"
                      value={row.external_name}
                      onChange={(e) => updateRow(row.charge_code_id, 'external_name', e.target.value)}
                      placeholder="Optional label"
                      className="w-full rounded-md border px-2 py-1 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5" style={{ backgroundColor: '#1B2A4A' }}>
        <Save className="h-3.5 w-3.5" />
        {saving ? 'Saving…' : 'Save Mappings'}
      </Button>
    </div>
  )
}
