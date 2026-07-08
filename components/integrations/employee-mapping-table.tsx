'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { IntegrationType } from '@/types'
import { INTEGRATION_META } from './meta'

interface KCUser {
  id: string
  full_name: string
  email: string
  department: string
}

interface MappingRow {
  kc_user_id: string
  external_id: string
  external_name: string
}

interface Props {
  integrationType: IntegrationType
  kcUsers: KCUser[]
}

export function EmployeeMappingTable({ integrationType, kcUsers }: Props) {
  const [rows, setRows] = useState<MappingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const meta = INTEGRATION_META[integrationType]

  useEffect(() => {
    fetch(`/api/integrations/${integrationType}/mappings`)
      .then((r) => r.json())
      .then((d: { mappings?: { kc_user_id: string; external_id: string; external_name: string | null }[] }) => {
        const existing = new Map(
          (d.mappings ?? []).map((m) => [m.kc_user_id, { external_id: m.external_id, external_name: m.external_name ?? '' }])
        )
        setRows(
          kcUsers.map((u) => ({
            kc_user_id: u.id,
            external_id: existing.get(u.id)?.external_id ?? '',
            external_name: existing.get(u.id)?.external_name ?? '',
          }))
        )
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [integrationType, kcUsers])

  function updateRow(userId: string, field: 'external_id' | 'external_name', value: string) {
    setRows((prev) =>
      prev.map((r) => (r.kc_user_id === userId ? { ...r, [field]: value } : r))
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/integrations/${integrationType}/mappings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: rows.filter((r) => r.external_id) }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Employee mappings saved.')
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
        Enter the {meta.name} employee ID for each KlockCadence user. Unmapped employees will be skipped during sync.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">KC Employee</th>
              <th className="text-left pb-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">{meta.name} ID</th>
              <th className="text-left pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Display Name (optional)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const user = kcUsers.find((u) => u.id === row.kc_user_id)!
              return (
                <tr key={row.kc_user_id} className="border-t">
                  <td className="py-2 pr-4">
                    <div className="text-sm font-medium">{user.full_name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      value={row.external_id}
                      onChange={(e) => updateRow(row.kc_user_id, 'external_id', e.target.value)}
                      placeholder="e.g. EMP-001"
                      className="w-full rounded-md border px-2 py-1 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      type="text"
                      value={row.external_name}
                      onChange={(e) => updateRow(row.kc_user_id, 'external_name', e.target.value)}
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
