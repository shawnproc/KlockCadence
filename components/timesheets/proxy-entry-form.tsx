'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ChargeCode, User } from '@/types'

interface ProxyEntryFormProps {
  employees: Pick<User, 'id' | 'full_name' | 'email' | 'department'>[]
  chargeCodes: ChargeCode[]
  defaultWeekStart: string
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
const REASON_MIN = 50

function getWeekDays(weekStart: string): string[] {
  const days: string[] = []
  const base = new Date(weekStart + 'T12:00:00Z')
  for (let i = 0; i < 5; i++) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    days.push(d.toISOString().split('T')[0]!)
  }
  return days
}

export function ProxyEntryForm({ employees, chargeCodes, defaultWeekStart }: ProxyEntryFormProps) {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState('')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [chargeCodeId, setChargeCodeId] = useState(chargeCodes[0]?.id ?? '')
  const [hours, setHours] = useState<Record<string, string>>({})
  const [proxyReason, setProxyReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const days = getWeekDays(weekStart)
  const reasonLength = proxyReason.trim().length
  const reasonValid = reasonLength >= REASON_MIN
  const hasHours = days.some((d) => parseFloat(hours[d] ?? '0') > 0)

  const canSubmit = employeeId && chargeCodeId && hasHours && reasonValid && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const hoursPayload: Record<string, number> = {}
      for (const day of days) {
        const h = parseFloat(hours[day] ?? '0')
        if (h > 0) hoursPayload[day] = h
      }

      const res = await fetch('/api/timesheets/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          week_start_date: weekStart,
          charge_code_id: chargeCodeId,
          hours: hoursPayload,
          proxy_reason: proxyReason,
        }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Submission failed.')
      }

      toast.success('Proxy entry created. Employee has been notified by email.')
      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create proxy entry.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <h2 className="text-lg font-semibold text-green-800">Proxy Entry Created</h2>
        <p className="text-sm text-green-700">
          The employee has been notified by email and must acknowledge the entry within 48 hours.
          This entry has been recorded in the immutable audit log.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => { setSubmitted(false); setHours({}); setProxyReason('') }}>
            Create Another
          </Button>
          <Button onClick={() => router.push('/timesheets')}>
            Back to Timesheets
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* DCAA notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>DCAA Proxy Entry:</strong> Per policy §7, proxy entries are permitted for documented absence or travel only.
          All fields are required and written to the immutable audit log. The employee will be notified by email and must acknowledge within 48 hours.
        </p>
      </div>

      {/* Employee + Week */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Employee <span className="text-red-500">*</span></label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
          >
            <option value="">Select employee…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}{emp.department ? ` — ${emp.department}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Week Starting (Monday) <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => { setWeekStart(e.target.value); setHours({}) }}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
          />
        </div>
      </div>

      {/* Charge code */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Charge Code <span className="text-red-500">*</span></label>
        <select
          value={chargeCodeId}
          onChange={(e) => setChargeCodeId(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
        >
          {chargeCodes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.description}
            </option>
          ))}
        </select>
      </div>

      {/* Hours per day */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Hours by Day <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-5 gap-3">
          {days.map((day, i) => {
            const label = DAY_LABELS[i]
            const dateNum = new Date(day + 'T12:00:00Z').getUTCDate()
            return (
              <div key={day} className="space-y-1">
                <div className="text-xs text-center font-medium text-muted-foreground">{label}</div>
                <div className="text-xs text-center text-muted-foreground">{dateNum}</div>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.25"
                  value={hours[day] ?? ''}
                  onChange={(e) => setHours((prev) => ({ ...prev, [day]: e.target.value }))}
                  placeholder="0"
                  className="w-full text-center border rounded-lg px-2 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
                />
              </div>
            )
          })}
        </div>
        {!hasHours && (
          <p className="text-xs text-muted-foreground">Enter hours for at least one day.</p>
        )}
      </div>

      {/* Proxy reason */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">
            Justification / Proxy Reason <span className="text-red-500">*</span>
          </label>
          <span className={`text-xs tabular-nums ${reasonValid ? 'text-green-600' : 'text-muted-foreground'}`}>
            {reasonLength}/{REASON_MIN} chars min
          </span>
        </div>
        <textarea
          value={proxyReason}
          onChange={(e) => setProxyReason(e.target.value)}
          rows={4}
          required
          placeholder="Describe why proxy entry is necessary — e.g., employee is traveling for client site visit and unable to access the system. All time has been pre-authorized by project manager. (minimum 50 characters)"
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:ring-2 focus:outline-none transition-colors ${
            proxyReason && !reasonValid
              ? 'border-red-400 focus:ring-red-400'
              : reasonValid
              ? 'border-green-400 focus:ring-green-400'
              : 'border-input focus:ring-ring'
          }`}
        />
        <p className="text-xs text-muted-foreground">
          Keep it general. Do <strong>not</strong> include CUI, confidential, secret, or top-secret information.
        </p>
        {proxyReason && !reasonValid && (
          <p className="text-xs text-red-500">
            Minimum {REASON_MIN} characters required. DCAA requires documented justification for all proxy entries.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.push('/timesheets')}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit}
          style={{ backgroundColor: canSubmit ? '#1B2A4A' : undefined }}
        >
          {submitting ? 'Creating Entry…' : 'Create Proxy Entry'}
        </Button>
      </div>
    </form>
  )
}
