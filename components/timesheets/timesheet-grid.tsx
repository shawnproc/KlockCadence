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
import { Plus, Trash2, Send, CheckCircle } from 'lucide-react'

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
}

interface GridRow {
  charge_code_id: string
  entries: Record<string, string> // work_date -> hours (string for input)
  work_description: string
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
}: TimesheetGridProps) {
  const supabase = createClient()
  const [timesheet, setTimesheet] = useState<Timesheet | null>(initialTimesheet)
  const [rows, setRows] = useState<GridRow[]>(() => buildInitialRows(initialEntries, days, chargeCodes))
  const [certModalOpen, setCertModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

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
      // Use the first non-empty description found for this charge code row
      if (entry.work_description && !grouped[entry.charge_code_id]!.work_description) {
        grouped[entry.charge_code_id]!.work_description = entry.work_description
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
    return rows.reduce((sum, row) => sum + (parseFloat(row.entries[date] ?? '0') || 0), 0)
  }

  function getWeekTotal(): number {
    return days.reduce((sum, d) => sum + getDayTotal(d), 0)
  }

  async function saveEntries(): Promise<string> {
    setSaving(true)
    try {
      // Ensure timesheet row exists
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

      // Delete and re-insert entries for this timesheet
      await supabase.from('timesheet_entries').delete().eq('timesheet_id', ts!.id)

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
    // Validate work descriptions — required by DCAA CAM before certification
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

    // Validate total time accounting
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
          created_at: '',
          entry_created_at: new Date().toISOString(),
        }))
    )

    const validation = validateWeeklyHours(entriesFlat, days, approvedLeaveHours)
    if (!validation.valid) {
      toast.error(validation.errors[0] ?? 'Hours validation failed.')
      return
    }

    setCertModalOpen(true)
  }

  async function handleCertify(typedName: string) {
    try {
      const tsId = await saveEntries()

      // Mark certified
      const { error: certError } = await supabase
        .from('timesheets')
        .update({
          certified_by_employee: true,
          certified_at: new Date().toISOString(),
          status: 'submitted',
        })
        .eq('id', tsId)

      if (certError) throw new Error(certError.message)

      // Audit log + server-side validation via API
      const certRes = await fetch('/api/timesheets/certify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timesheet_id: tsId, typed_name: typedName }),
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
                  {/* Hours row */}
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
                              disabled={isWeekend}
                              placeholder={isWeekend ? '' : '0'}
                              className="w-14 text-center text-sm border rounded px-1 py-1 bg-background focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-0"
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
                    <td
                      colSpan={days.length + (isLocked ? 2 : 3)}
                      className="px-4 pt-1 pb-3"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-muted-foreground font-medium shrink-0 mt-1.5 w-28">
                          Work Description
                          {!isLocked && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
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
                                descMissing
                                  ? 'border-red-400 focus:ring-red-400'
                                  : 'border-input'
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
