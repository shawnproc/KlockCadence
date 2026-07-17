'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Download, BarChart3, Users, Clock, TrendingUp } from 'lucide-react'
import type { LaborRow } from '@/app/api/reports/labor-distribution/route'

interface LaborDistributionReportProps {
  orgId: string
  orgName: string
}

type ViewMode = 'employee' | 'charge_code'

function formatHours(h: number) {
  return h.toFixed(2)
}

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string) {
  const [year, mon] = ym.split('-')
  return new Date(`${year}-${mon}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function LaborDistributionReport({ orgName }: LaborDistributionReportProps) {
  const [month, setMonth] = useState(currentYearMonth())
  const [rows, setRows] = useState<LaborRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('employee')

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/labor-distribution?month=${month}`)
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Report generation failed.')
      }
      const data = await res.json() as { rows: LaborRow[] }
      setRows(data.rows)
      setGenerated(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate report.')
    } finally {
      setLoading(false)
    }
  }

  function handleExportCSV() {
    if (rows.length === 0) return
    const label = monthLabel(month)

    const csvData = rows.map((r) => ({
      'Month':                label,
      'Employee Name':        r.employee_name,
      'Email':                r.employee_email,
      'Department':           r.department,
      'Charge Code':          r.charge_code,
      'Contract Number':      r.contract_number,
      'Charge Description':   r.charge_description,
      'Billable (Y/N)':       r.is_billable ? 'Y' : 'N',
      'Total Hours':          formatHours(r.total_hours),
      'Includes Proxy Hours': r.has_proxy_hours ? 'Y' : 'N',
      'GL Account':           r.is_billable ? 'Direct Labor' : 'Indirect/Overhead',
      'GL Entry Memo':        `${r.is_billable ? 'Direct Labor' : 'Indirect Labor'} ${r.charge_code}${r.contract_number ? ` / ${r.contract_number}` : ''} ${label}`,
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Labor_Distribution_${orgName.replace(/\s+/g, '_')}_${month}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('CSV exported.')
  }

  // Derived aggregates
  const totalHours = rows.reduce((s, r) => s + r.total_hours, 0)
  const billableHours = rows.filter((r) => r.is_billable).reduce((s, r) => s + r.total_hours, 0)
  const indirectHours = totalHours - billableHours
  const uniqueEmployees = new Set(rows.map((r) => r.employee_email)).size

  // By-employee grouped data
  const byEmployee: Record<string, { rows: LaborRow[]; total: number }> = {}
  for (const r of rows) {
    const key = r.employee_email
    if (!byEmployee[key]) byEmployee[key] = { rows: [], total: 0 }
    byEmployee[key]!.rows.push(r)
    byEmployee[key]!.total += r.total_hours
  }

  // By-charge-code grouped data
  const byChargeCode: Record<string, { rows: LaborRow[]; total: number; is_billable: boolean; contract_number: string }> = {}
  for (const r of rows) {
    const key = r.charge_code
    if (!byChargeCode[key]) {
      byChargeCode[key] = { rows: [], total: 0, is_billable: r.is_billable, contract_number: r.contract_number }
    }
    byChargeCode[key]!.rows.push(r)
    byChargeCode[key]!.total += r.total_hours
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setGenerated(false) }}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          style={{ backgroundColor: '#1B2A4A' }}
        >
          <BarChart3 className="h-4 w-4 mr-1.5" />
          {loading ? 'Generating…' : 'Generate Report'}
        </Button>
        {generated && rows.length > 0 && (
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV (QuickBooks GL)
          </Button>
        )}
      </div>

      {/* QuickBooks note */}
      {generated && rows.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          <strong>QuickBooks GL Import:</strong> The exported CSV includes GL Account and GL Entry Memo columns.
          Map <em>Direct Labor</em> to your billable labor GL account and <em>Indirect/Overhead</em> to your overhead account.{' '}
          Multiply hours by each employee&apos;s burdened rate to calculate the debit amount.
          Credit <em>Wages Payable</em> for the corresponding total.
        </div>
      )}

      {/* Payroll reconciliation note (DCAA: labor distribution ties to payroll) */}
      {generated && rows.length > 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <strong>Payroll reconciliation:</strong> Each employee&apos;s total hours below is the figure that must
          reconcile to the hours paid in payroll for this period — the labor charged here should equal the labor
          paid. Use approved timesheets for the final reconciliation. (KlockCadence provides the labor side;
          tie it out against your payroll/accounting system.)
        </div>
      )}

      {/* Summary cards */}
      {generated && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Hours', value: formatHours(totalHours), icon: Clock, color: '#1B2A4A' },
            { label: 'Billable Hours', value: formatHours(billableHours), icon: TrendingUp, color: '#16A34A' },
            { label: 'Indirect Hours', value: formatHours(indirectHours), icon: BarChart3, color: '#D97706' },
            { label: 'Employees', value: String(uniqueEmployees), icon: Users, color: '#7C3AED' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
                  </div>
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table view */}
      {generated && rows.length > 0 && (
        <div className="space-y-3">
          {/* Toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            {(['employee', 'charge_code'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  viewMode === v
                    ? 'bg-white shadow text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'employee' ? 'By Employee' : 'By Charge Code'}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              {viewMode === 'employee' ? (
                <>
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-4 py-3 font-medium">Employee</th>
                      <th className="text-left px-4 py-3 font-medium">Department</th>
                      <th className="text-left px-4 py-3 font-medium">Charge Code</th>
                      <th className="text-left px-4 py-3 font-medium">Contract #</th>
                      <th className="text-center px-4 py-3 font-medium">Billable</th>
                      <th className="text-right px-4 py-3 font-medium">Hours</th>
                      <th className="text-center px-3 py-3 font-medium text-xs text-muted-foreground">Proxy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byEmployee).map(([email, group]) => (
                      group.rows.map((r, i) => (
                        <tr key={`${email}-${r.charge_code}`} className={`border-t ${i === 0 ? 'bg-muted/5' : ''}`}>
                          {i === 0 ? (
                            <td className="px-4 py-2.5" rowSpan={group.rows.length}>
                              <div className="font-medium text-xs">{r.employee_name}</div>
                              <div className="text-xs text-muted-foreground">{email}</div>
                              <div className="text-xs font-semibold text-primary mt-1 tabular-nums">
                                {formatHours(group.total)}h total
                              </div>
                            </td>
                          ) : null}
                          <td className="px-4 py-2 text-xs text-muted-foreground">{r.department || '—'}</td>
                          <td className="px-4 py-2">
                            <div className="text-xs font-medium">{r.charge_code}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{r.charge_description}</div>
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{r.contract_number || '—'}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              r.is_billable
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {r.is_billable ? 'Direct' : 'Indirect'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatHours(r.total_hours)}</td>
                          <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                            {r.has_proxy_hours ? '⚑' : ''}
                          </td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-4 py-3 font-medium">Charge Code</th>
                      <th className="text-left px-4 py-3 font-medium">Contract #</th>
                      <th className="text-center px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium">Employee</th>
                      <th className="text-left px-4 py-3 font-medium">Department</th>
                      <th className="text-right px-4 py-3 font-medium">Hours</th>
                      <th className="text-center px-3 py-3 font-medium text-xs text-muted-foreground">Proxy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byChargeCode)
                      .sort(([, a], [, b]) => Number(b.is_billable) - Number(a.is_billable))
                      .map(([code, group]) => (
                        group.rows.map((r, i) => (
                          <tr key={`${code}-${r.employee_email}`} className="border-t">
                            {i === 0 ? (
                              <td className="px-4 py-2.5" rowSpan={group.rows.length}>
                                <div className="font-medium text-xs">{code}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[160px]">{r.charge_description}</div>
                                <div className="text-xs font-semibold text-primary mt-1 tabular-nums">
                                  {formatHours(group.total)}h total
                                </div>
                              </td>
                            ) : null}
                            {i === 0 ? (
                              <td className="px-4 py-2 text-xs text-muted-foreground" rowSpan={group.rows.length}>
                                {group.contract_number || '—'}
                              </td>
                            ) : null}
                            {i === 0 ? (
                              <td className="px-4 py-2 text-center" rowSpan={group.rows.length}>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  group.is_billable
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {group.is_billable ? 'Direct' : 'Indirect'}
                                </span>
                              </td>
                            ) : null}
                            <td className="px-4 py-2">
                              <div className="text-xs font-medium">{r.employee_name}</div>
                              <div className="text-xs text-muted-foreground">{r.employee_email}</div>
                            </td>
                            <td className="px-4 py-2 text-xs text-muted-foreground">{r.department || '—'}</td>
                            <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatHours(r.total_hours)}</td>
                            <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                              {r.has_proxy_hours ? '⚑' : ''}
                            </td>
                          </tr>
                        ))
                      ))}
                  </tbody>
                </>
              )}
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td colSpan={viewMode === 'employee' ? 5 : 5} className="px-4 py-2.5 text-xs">
                    Total — {monthLabel(month)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatHours(totalHours)}h</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚑ = row includes at least one proxy entry. Only submitted and approved timesheets are included.
          </p>
        </div>
      )}

      {generated && rows.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground font-medium">No approved timesheets found for {monthLabel(month)}.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Only submitted and approved timesheets are included. Draft timesheets are excluded.
          </p>
        </div>
      )}
    </div>
  )
}
