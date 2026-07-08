'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

function defaultRange() {
  const now = new Date()
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const end = now.toISOString().split('T')[0]!
  return { start, end }
}

export function LaborDistributionExport() {
  const [range, setRange] = useState(defaultRange)
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/labor-distribution/csv?start=${range.start}&end=${range.end}`)
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Export failed.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Timesheets_${range.start}_${range.end}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Start Date</label>
        <input
          type="date"
          value={range.start}
          onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">End Date</label>
        <input
          type="date"
          value={range.end}
          onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
          className="border rounded-lg px-3 py-2 text-sm bg-background focus:ring-2 focus:ring-ring focus:outline-none"
        />
      </div>
      <Button onClick={handleExport} disabled={loading} style={{ backgroundColor: '#1B2A4A' }}>
        <Download className="h-4 w-4 mr-1.5" />
        {loading ? 'Exporting…' : 'Download CSV'}
      </Button>
    </div>
  )
}
