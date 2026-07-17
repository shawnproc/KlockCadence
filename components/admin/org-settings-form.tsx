'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import type { Organization } from '@/types'

interface OrgSettingsFormProps {
  org: Organization
}

export function OrgSettingsForm({ org }: OrgSettingsFormProps) {
  const supabase = createClient()
  const [form, setForm] = useState({
    name: org.name,
    fiscal_year_start: org.fiscal_year_start,
    holiday_schedule: org.holiday_schedule,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('organizations')
        .update(form)
        .eq('id', org.id)

      if (error) throw new Error(error.message)
      toast.success('Settings saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Card className="max-w-lg">
      <CardContent className="pt-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Organization Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fiscal Year Start</Label>
            <Input
              type="date"
              value={form.fiscal_year_start}
              onChange={(e) => setForm((f) => ({ ...f, fiscal_year_start: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Holiday Schedule</Label>
            <select
              value={form.holiday_schedule}
              onChange={(e) => setForm((f) => ({ ...f, holiday_schedule: e.target.value as 'federal' | 'custom' }))}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
            >
              <option value="federal">Federal</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Org Slug (read-only)</Label>
            <Input value={org.slug} disabled className="font-mono text-xs" />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>

    <Card className="max-w-lg">
      <CardContent className="pt-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold">Company Access</h2>
          <p className="text-sm text-muted-foreground">Controls how people sign up and join {org.name}.</p>
        </div>

        <div className="space-y-1.5">
          <Label>Company Code</Label>
          <Input value={org.company_code} disabled className="font-mono tracking-widest" />
          <p className="text-xs text-muted-foreground">
            Share with employees so they can sign up and join. Everyone joins as a regular employee; promote
            people to manager/admin from the Users page.
          </p>
        </div>
      </CardContent>
    </Card>
    </>
  )
}
