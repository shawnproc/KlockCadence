'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Download, FileText, AlertTriangle, ScrollText, Calendar } from 'lucide-react'

interface DCAAExportFormProps {
  orgId: string
  orgName: string
}

interface ExportOptions {
  include_timesheets: boolean
  include_leave: boolean
  include_anomalies: boolean
  include_audit_log: boolean
}

export function DCAAExportForm({ orgId, orgName }: DCAAExportFormProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [options, setOptions] = useState<ExportOptions>({
    include_timesheets: true,
    include_leave: true,
    include_anomalies: true,
    include_audit_log: true,
  })
  const [generating, setGenerating] = useState(false)

  function toggleOption(key: keyof ExportOptions) {
    setOptions((o) => ({ ...o, [key]: !o[key] }))
  }

  async function handleExport() {
    if (!startDate || !endDate) {
      toast.error('Select a date range.')
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error('End date must be after start date.')
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/dcaa/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, start_date: startDate, end_date: endDate, ...options }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Export failed.')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `DCAA_Audit_Package_${orgName.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success('Audit package downloaded.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setGenerating(false)
    }
  }

  const SECTIONS = [
    { key: 'include_timesheets' as const, label: 'Timesheets & Certifications', icon: FileText,
      description: 'All timesheets, approval chains, employee certifications with typed names' },
    { key: 'include_leave' as const, label: 'Leave Records', icon: Calendar,
      description: 'Leave balances, accrual history, request & approval log' },
    { key: 'include_anomalies' as const, label: 'Anomaly & Late Entry Log', icon: AlertTriangle,
      description: 'All compliance anomalies including late entry patterns' },
    { key: 'include_audit_log' as const, label: 'Full Audit Trail', icon: ScrollText,
      description: 'Complete immutable audit log filtered to date range' },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Include</p>
            {SECTIONS.map(({ key, label, icon: Icon, description }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={() => toggleOption(key)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium group-hover:text-primary transition-colors">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">One-Click DCAA Audit Package</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF output formatted to DCAA auditor expectations. Includes all timesheets with approval
                  chains, employee certifications with full legal names and timestamps, complete anomaly
                  log, late entry documentation, leave balance history, and the full immutable audit trail.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleExport}
          disabled={generating || !startDate || !endDate}
          className="w-full gap-2"
          size="lg"
        >
          <Download className="h-4 w-4" />
          {generating ? 'Generating Package…' : 'Generate Audit Package'}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Audit packages are logged in the immutable audit trail.
        </p>
      </div>
    </div>
  )
}
