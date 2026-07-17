'use client'

import { useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CertificationModal } from './certification-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatWeekRange } from '@/lib/utils'
import { validateWeeklyHours } from '@/lib/dcaa/validators'
import type { ChargeCode, Timesheet, TimesheetEntry } from '@/types'
import { Plus, Trash2, Send, CheckCircle, ShieldAlert, CheckCircle2 } from 'lucide-react'

interface TimesheetGridProps {
  timesheet: Timesheet | null
  weekStart: string
  days: string[]
  chargeCodes: ChargeCode[]
  initialEntries: TimesheetEntry[]
  userId: string
  orgId: string
  fullName: string
  approvedLeaveHours: number
  proxyActorNames: Record<string, string>
}

interface GridRow {
  charge_code_id: string
  entries: Record<string, string> // work_date -> hours (string for input)
  work_description: string
}

interface ProxyRow {
  charge_code_id: string
  entries: Record<string, string> // work_date -> hours display
  proxy_reason: string
  proxy_actor_id: string
  entry_ids: string[]
  employee_acknowledged: boolean
  employee_acknowledged_at: string | null
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function TimesheetGrid({
  timesheet: initialTimesheet,
  weekStart,
  days,
  chargeCodes,
  initialEntries,
  userId,
  orgId,
  fullName,
  approvedLeaveHours,
  proxyActorNames,
}: TimesheetGridProps) {
  const supabase = createClient()
  const [timesheet, setTimesheet] = useState<Timesheet | null>(initialTimesheet)
  const [rows, setRows] = useState<GridRow[]>(() =>
    buildInitialRows(initialEntries.filter((e) => !e.is_proxy_entry), days, chargeCodes)
  )
  const [proxyRows, setProxyRows] = useState<ProxyRow[]>(() =>
    buildProxyRows(initialEntries.filter((e) => e.is_proxy_entry))
  )
  const [certModalOpen, setCertModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [acknowledging, setAcknowledging] = useState<Record<string, boolean>>({})
  // Reason for correcting a previously-rejected timesheet (DCAA: changes need a documented reason).
  const [changeReason, setChangeReason] = useState('')

  const isLocked = timesheet?.certified_by_employee === true && timesheet.status !== 'rejected'
  const weekRange = formatWeekRange(weekStart)

  function buildInitialRows(entries: TimesheetEntry[], _days: string[], codes: ChargeCode[]): GridRow[] {
    if (entries.length === 0 && codes.length > 0) {
      return [{ charge_code_id: codes[0]!.id, entries: {}, work_description: '' }]
    }
    const grouped: Record<string, GridRow> = {}
    for (const entry of entries) {
      if (!grouped[entry.charge_code_id]) {
        grouped[entry.charge_code_id] = {
          charge_code_id: entry.charge_code_id,
          entries: {},
          work_description: entry.work_description,
        }
      }
      grouped[entry.charge_code_id]!.entries[entry.work_date] = String(entry.hours)
      if (entry.work_description && !grouped[entry.charge_code_id]!.work_description) {
        grouped[entry.charge_code_id]!.work_description = entry.work_description
      }
    }
    return Object.values(grouped)
  }

  function buildProxyRows(entries: TimesheetEntry[]): ProxyRow[] {
    const grouped: Record<string, ProxyRow> = {}
    for (const entry of entries) {
      const key = `${entry.charge_code_id}::${entry.proxy_actor_id ?? ''}`
      if (!grouped[key]) {
        grouped[key] = {
          charge_code_id: entry.charge_code_id,
          entries: {},
          proxy_reason: entry.proxy_reason ?? '',
          proxy_actor_id: entry.proxy_actor_id ?? '',
          entry_ids: [],
          employee_acknowledged: entry.employee_acknowledged,
          employee_acknowledged_at: entry.employee_acknowledged_at,
        }
      }
      grouped[key]!.entries[entry.work_date] = String(entry.hours)
      grouped[key]!.entry_ids.push(entry.id)
      // If ANY entry in the row is unacknowledged, the whole row is unacknowledged
      if (!entry.employee_acknowledged) {
        grouped[key]!.employee_acknowledged = false
        grouped[key]!.employee_acknowledged_at = null
      }
    }
    return Object.values(grouped)
  }

  function addRow() {
    const usedIds = new Set(rows.map((r) => r.charge_code_id))
    const nextCode = chargeCodes.find((c) => !usedIds.has(c.id))
    if (!nextCode) {
      toast.error('All charge codes already added.')
      return
    }
    setRows([...rows, { charge_code_id: nextCode.id, entries: {}, work_description: '' }])
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  function updateHours(rowIdx: number, date: string, val: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === rowIdx ? { ...row, entries: { ...row.entries, [date]: val } } : row
      )
    )
  }

  function updateChargeCode(rowIdx: number, codeId: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === rowIdx ? { ...row, charge_code_id: codeId } : row))
    )
  }

  function updateWorkDescription(rowIdx: number, val: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === rowIdx ? { ...row, work_description: val } : row))
    )
  }

  function getDayTotal(date: string): number {
    const regular = rows.reduce((sum, row) => sum + (parseFloat(row.entries[date] ?? '0') || 0), 0)
    const proxy = proxyRows.reduce((sum, row) => sum + (parseFloat(row.entries[date] ?? '0') || 0), 0)
    return regular + proxy
  }

  function getWeekTotal(): number {
    return days.reduce((sum, d) => sum + getDayTotal(d), 0)
  }

  async function handleAcknowledgeProxy(rowIdx: number) {
    const row = proxyRows[rowIdx]!
    const key = row.entry_ids[0] ?? String(rowIdx)
    setAcknowledging((a) => ({ ...a, [key]: true }))
    try {
      const res = await fetch('/api/timesheets/proxy/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_ids: row.entry_ids }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Acknowledgment failed.')
      }
      const { acknowledged_at } = await res.json() as { acknowledged_at: string }
      setProxyRows((prev) =>
        prev.map((r, i) =>
          i === rowIdx
            ? { ...r, employee_acknowledged: true, employee_acknowledged_at: acknowledged_at }
            : r
        )
      )
      toast.success('Proxy entry acknowledged.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Acknowledgment failed.')
    } finally {
      setAcknowledging((a) => ({ ...a, [key]: false }))
    }
  }

  async function saveEntries(): Promise<string> {
    setSaving(true)
    try {
      let ts = timesheet
      if (!ts) {
        const { data, error } = await supabase
          .from('timesheets')
          .insert({ org_id: orgId, user_id: userId, week_start_date: weekStart, status: 'draft' })
          .select()
          .single()
        if (error) throw new Error(error.message)
        ts = data
        setTimesheet(ts)
      }

      // Only delete non-proxy entries — proxy entries are managed by the proxy API
      await supabase
        .from('timesheet_entries')
        .delete()
        .eq('timesheet_id', ts!.id)
        .eq('is_proxy_entry', false)

      const entriesToInsert = rows.flatMap((row) =>
        Object.entries(row.entries)
          .filter(([, h]) => h !== '' && parseFloat(h) > 0)
          .map(([date, hours]) => ({
            org_id: orgId,
            timesheet_id: ts!.id,
            user_id: userId,
            charge_code_id: row.charge_code_id,
            work_date: date,
            hours: parseFloat(hours),
            work_description: row.work_description,
            is_proxy_entry: false,
            entry_created_at: new Date().toISOString(),
          }))
      )

      if (entriesToInsert.length > 0) {
        const { error } = await supabase.from('timesheet_entries').insert(entriesToInsert)
        if (error) throw new Error(error.message)
      }

      return ts!.id
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDraft() {
    try {
      await saveEntries()
      toast.success('Draft saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed.')
    }
  }

  async function handleSubmitClick() {
    const rowsWithHours = rows.filter((row) =>
      Object.values(row.entries).some((h) => h !== '' && parseFloat(h) > 0)
    )
    const missingDesc = rowsWithHours.filter((row) => row.work_description.trim().length < 10)
    if (missingDesc.length > 0) {
      const code = chargeCodes.find((c) => c.id === missingDesc[0]!.charge_code_id)
      toast.error(
        `Work description required for "${code?.code ?? 'charge code'}" — minimum 10 characters. DCAA requires documented work descriptions for all time entries.`
      )
      return
    }

    const entriesFlat = rowsWithHours.flatMap((row) =>
      Object.entries(row.entries)
        .filter(([, h]) => h !== '' && parseFloat(h) > 0)
        .map(([date, hours]) => ({
          id: '',
          org_id: orgId,
          timesheet_id: timesheet?.id ?? '',
          user_id: userId,
          charge_code_id: row.charge_code_id,
          work_date: date,
          hours: parseFloat(hours),
          work_description: row.work_description,
          is_proxy_entry: false,
          proxy_actor_id: null,
          proxy_reason: null,
          employee_acknowledged: false,
          employee_acknowledged_at: null,
          created_at: '',
          entry_created_at: new Date().toISOString(),
        }))
    )

    const validation = validateWeeklyHours(entriesFlat, days, approvedLeaveHours)
    if (!validation.valid) {
      toast.error(validation.errors[0] ?? 'Hours validation failed.')
      return
    }

    // DCAA: a correction to a previously-rejected timesheet must document why.
    if (timesheet?.status === 'rejected' && changeReason.trim().length < 5) {
      toast.error('Enter a brief reason for the correction — DCAA requires changes to be documented.')
      return
    }

    setCertModalOpen(true)
  }

  async function handleCertify(typedName: string) {
    try {
      // Save the draft entries first, then let the server certify + submit
      // (it validates ownership, the typed name, and work descriptions, and
      // sets the certified flag itself — never trusted to the client).
      const tsId = await saveEntries()

      const certRes = await fetch('/api/timesheets/certify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheet_id: tsId, typed_name: typedName, change_reason: changeReason.trim() || null }),
      })

      if (!certRes.ok) {
        const err = await certRes.json() as { error?: string }
        throw new Error(err.error ?? 'Certification failed.')
      }

      setTimesheet((prev) =>
        prev ? { ...prev, certified_by_employee: true, status: 'submitted' } : prev
      )
      toast.success('Timesheet certified and submitted.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Certification failed.')
    }
  }

  const pendingProxyAck = proxyRows.filter((r) => !r.employee_acknowledged).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Week of {weekRange}</h2>
          {timesheet && (
            <Badge
              variant={timesheet.status as 'draft' | 'submitted' | 'approved' | 'rejected'}
              className="mt-1"
            >
              {timesheet.status}
            </Badge>
          )}
        </div>
        {!isLocked && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button size="sm" onClick={handleSubmitClick} disabled={saving}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Submit
            </Button>
          </div>
        )}
        {isLocked && timesheet?.status === 'approved' && (
          <div className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            Approved
          </div>
        )}
      </div>

      {timesheet?.status === 'rejected' && timesheet.rejection_reason && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Rejected:</strong> {timesheet.rejection_reason}
        </div>
      )}

      {timesheet?.status === 'rejected' && !isLocked && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Reason for correction <span className="text-red-500">*</span>
          </label>
          <textarea
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            rows={2}
            placeholder="Briefly explain what you changed and why (recorded in the audit log)."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
          />
        </div>
      )}

      {pendingProxyAck > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-orange-300 bg-orange-50 px-4 py-3">
          <ShieldAlert className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-800">
            <strong>Action Required:</strong> You have {pendingProxyAck} proxy entr{pendingProxyAck === 1 ? 'y' : 'ies'} that require your acknowledgment.
            Unacknowledged proxy entries are flagged as a DCAA compliance anomaly after 48 hours.
          </p>
        </div>
      )}

      {!isLocked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <strong>DCAA Requirement:</strong> All time entries must include a work description (minimum 10 characters) before submission.
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border timesheet-grid">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium w-48">Charge Code</th>
              {days.map((d, i) => {
                const isWeekend = new Date(d).getDay() === 0 || new Date(d).getDay() === 6
                return (
                  <th
                    key={d}
                    className={`px-2 py-3 font-medium text-center w-16 ${isWeekend ? 'text-muted-foreground/60' : ''}`}
                  >
                    <div>{DAY_LABELS[i]}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {new Date(d).getDate()}
                    </div>
                  </th>
                )
              })}
              <th className="px-4 py-3 font-medium text-right w-16">Total</th>
              {!isLocked && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {/* Regular editable rows */}
            {rows.map((row, rowIdx) => {
              const rowTotal = days.reduce(
                (sum, d) => sum + (parseFloat(row.entries[d] ?? '0') || 0),
                0
              )
              const code = chargeCodes.find((c) => c.id === row.charge_code_id)
              const hasHours = Object.values(row.entries).some(
                (h) => h !== '' && parseFloat(h) > 0
              )
              const descMissing = !isLocked && hasHours && row.work_description.trim().length < 10

              return (
                <Fragment key={rowIdx}>
                  <tr className="border-t">
                    <td className="px-4 py-2">
                      {isLocked ? (
                        <div>
                          <div className="font-medium text-xs">{code?.code}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {code?.description}
                          </div>
                        </div>
                      ) : (
                        <select
                          value={row.charge_code_id}
                          onChange={(e) => updateChargeCode(rowIdx, e.target.value)}
                          className="w-full text-xs border rounded px-2 py-1.5 bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                        >
                          {chargeCodes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} — {c.description}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    {days.map((d) => {
                      const isWeekend = new Date(d).getDay() === 0 || new Date(d).getDay() === 6
                      return (
                        <td key={d} className={`px-1 py-2 ${isWeekend ? 'bg-muted/30' : ''}`}>
                          {isLocked ? (
                            <div className="text-center w-14">
                              {row.entries[d] && parseFloat(row.entries[d]!) > 0
                                ? row.entries[d]
                                : ''}
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max="24"
                              step="0.25"
                              value={row.entries[d] ?? ''}
                              onChange={(e) => updateHours(rowIdx, d, e.target.value)}
                              placeholder="0"
                              title={isWeekend ? 'Weekend — record any hours actually worked (all hours worked must be recorded)' : undefined}
                              className="w-14 text-center text-sm border rounded px-1 py-1 bg-background focus:ring-1 focus:ring-ring focus:outline-none"
                            />
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-2 text-right font-medium tabular-nums">
                      {rowTotal > 0 ? rowTotal : ''}
                    </td>
                    {!isLocked && (
                      <td className="pr-2">
                        {rows.length > 1 && (
                          <button
                            onClick={() => removeRow(rowIdx)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>

                  {/* Work description row */}
                  <tr className="bg-muted/10">
                    <td colSpan={days.length + (isLocked ? 2 : 3)} className="px-4 pt-1 pb-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground font-medium shrink-0 mt-1.5 w-28">
                          Work Description
                          {!isLocked && <span className="text-red-500 ml-0.5">*</span>}
                        </span>
                        {isLocked ? (
                          <p className="text-xs text-muted-foreground italic mt-1.5">
                            {row.work_description || '—'}
                          </p>
                        ) : (
                          <div className="flex-1">
                            <textarea
                              value={row.work_description}
                              onChange={(e) => updateWorkDescription(rowIdx, e.target.value)}
                              placeholder="Describe the work performed on this charge code (min. 10 characters)"
                              rows={2}
                              className={`w-full text-xs border rounded px-2 py-1.5 bg-background resize-none focus:ring-1 focus:outline-none focus:ring-ring transition-colors ${
                                descMissing ? 'border-red-400 focus:ring-red-400' : 'border-input'
                              }`}
                            />
                            {descMissing && (
                              <p className="text-xs text-red-500 mt-0.5">
                                Required before submission — DCAA CAM §6-100 requires documented work descriptions.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              )
            })}

            {/* Proxy rows — read-only, orange tinted */}
            {proxyRows.map((row, rowIdx) => {
              const rowTotal = days.reduce(
                (sum, d) => sum + (parseFloat(row.entries[d] ?? '0') || 0),
                0
              )
              const code = chargeCodes.find((c) => c.id === row.charge_code_id)
              const actorName = proxyActorNames[row.proxy_actor_id] ?? 'Manager'
              const ackKey = row.entry_ids[0] ?? String(rowIdx)
              const isAcknowledging = acknowledging[ackKey] ?? false

              return (
                <Fragment key={`proxy-${rowIdx}`}>
                  <tr className="border-t border-orange-200 bg-orange-50/40">
                    <td className="px-4 py-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">
                            Proxy
                          </span>
                        </div>
                        <div className="font-medium text-xs mt-1">{code?.code}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {code?.description}
                        </div>
                      </div>
                    </td>
                    {days.map((d) => {
                      const isWeekend = new Date(d).getDay() === 0 || new Date(d).getDay() === 6
                      const h = parseFloat(row.entries[d] ?? '0')
                      return (
                        <td key={d} className={`px-1 py-2 ${isWeekend ? 'bg-orange-100/30' : ''}`}>
                          <div className="text-center w-14 text-orange-700 font-medium">
                            {h > 0 ? h : ''}
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-4 py-2 text-right font-medium tabular-nums text-orange-700">
                      {rowTotal > 0 ? rowTotal : ''}
                    </td>
                    {!isLocked && <td />}
                  </tr>

                  {/* Proxy detail row */}
                  <tr className="bg-orange-50/60 border-b border-orange-100">
                    <td colSpan={days.length + (isLocked ? 2 : 3)} className="px-4 pt-1 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5 flex-1">
                          <p className="text-xs text-orange-800">
                            <span className="font-medium">Entered by:</span> {actorName}
                          </p>
                          <p className="text-xs text-orange-800">
                            <span className="font-medium">Justification:</span> {row.proxy_reason}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {row.employee_acknowledged ? (
                            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Acknowledged
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleAcknowledgeProxy(rowIdx)}
                              disabled={isAcknowledging}
                              className="h-7 text-xs"
                              style={{ backgroundColor: '#EA580C' }}
                            >
                              {isAcknowledging ? 'Acknowledging…' : 'Acknowledge'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td className="px-4 py-2 text-xs font-medium text-muted-foreground">Daily Total</td>
              {days.map((d) => {
                const total = getDayTotal(d)
                const isWeekend = new Date(d).getDay() === 0 || new Date(d).getDay() === 6
                const isShort = !isWeekend && total < 8
                return (
                  <td
                    key={d}
                    className={`px-1 py-2 text-center text-xs font-semibold tabular-nums ${
                      total === 0 ? 'text-muted-foreground' : isShort ? 'text-orange-600' : 'text-foreground'
                    }`}
                  >
                    {total > 0 ? total : '—'}
                  </td>
                )
              })}
              <td className="px-4 py-2 text-right text-sm font-bold tabular-nums">
                {getWeekTotal()}h
              </td>
              {!isLocked && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {!isLocked && rows.length < chargeCodes.length && (
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Charge Code
        </Button>
      )}

      <CertificationModal
        open={certModalOpen}
        onOpenChange={setCertModalOpen}
        fullName={fullName}
        weekRange={weekRange}
        onConfirm={handleCertify}
      />
    </div>
  )
}
